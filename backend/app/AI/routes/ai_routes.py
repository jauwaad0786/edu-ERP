"""
1P360 BOT API Routes
Blueprint: ai_bp → registered at /api/ai

CRITICAL SECURITY:
- school_id and role are ALWAYS derived from JWT — NEVER from request body
- All routes enforce JWT authentication
- Super Admin routes enforce SUPER_ADMIN role
- Chat route enforces per-role quota BEFORE calling any AI provider

Rate limiting: basic per-user limiting via quota system.
"""
import os
import json
from datetime import datetime, date
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app import db
from app.models.user import User, UserRole
from app.AI.models.ai_models import (
    AIProviderConfig, AIRoleQuota, AIUsage,
    AIQueryCache, AIConversation, AIMessage, AIDocument
)
from app.AI.utils.encryption import encrypt_secret, decrypt_secret
from app.AI.config.ai_config import PROVIDERS, DEFAULT_QUOTAS
from app.AI.usage.quota_service import check_quota
from app.AI.core.chatbot_service import process_chat
from app.AI.rag.document_processor import validate_document, process_and_store_document

ai_bp = Blueprint('ai', __name__, url_prefix='/api/ai')


# ─── Helper: get current user (JWT) ─────────────────────────────────────────

def _get_user() -> User:
    user_id = int(get_jwt_identity())
    return User.query.get(user_id)


def _require_super_admin():
    user = _get_user()
    if not user or not user.is_active:
        return None, jsonify({'error': 'Authentication required'}), 401
    role = user.role.value if hasattr(user.role, 'value') else str(user.role)
    is_super = getattr(user, 'is_super', False)
    if role != 'SUPER_ADMIN' and not is_super:
        return None, jsonify({'error': 'Super Admin access required'}), 403
    return user, None, None



# ─── /api/ai/chat ─────────────────────────────────────────────────────────

@ai_bp.route('/chat', methods=['POST'])
@jwt_required()
def chat():
    """
    Primary chat endpoint. Used by both Principal and Teacher.

    Request body:
    {
        "message": str,           # required
        "conversation_id": int,   # optional — for history
        "document_id": int,       # optional — Teacher RAG
    }

    Response:
    {
        "answer": str,
        "intent": str,
        "cached": bool,
        "source": str,
        "usage": {"used", "limit", "remaining"},
        "latency": {...},
        "suggested_followups": [...],
        "conversation_id": int,
    }
    """
    user = _get_user()
    if not user or not user.is_active:
        return jsonify({'error': 'Authentication required'}), 401

    # NEVER trust school_id from frontend — derive from JWT
    school_id = user.school_id
    role      = user.role.value if hasattr(user.role, 'value') else str(user.role)

    # Only allow AI for supported roles
    ALLOWED_ROLES = {'SUPER_ADMIN', 'PRINCIPAL', 'DIRECTOR', 'VICE_PRINCIPAL', 'TEACHER', 'ACCOUNTANT',
                     'LIBRARIAN', 'HOSTEL', 'TRANSPORT'}
    if role not in ALLOWED_ROLES:
        return jsonify({'error': f'AI assistant is not available for role: {role}'}), 403

    if not school_id and role != 'SUPER_ADMIN':
        return jsonify({'error': 'No school associated with your account'}), 400

    school_id = school_id or 0


    data     = request.get_json() or {}
    message  = (data.get('message') or '').strip()
    conv_id  = data.get('conversation_id')
    doc_id   = data.get('document_id')

    if not message:
        return jsonify({'error': 'Message is required'}), 400

    if len(message) > 2000:
        return jsonify({'error': 'Message too long (max 2000 characters)'}), 400

    # Load conversation history for context
    history = []
    conversation = None
    if conv_id:
        conversation = AIConversation.query.filter_by(
            id=conv_id, user_id=user.id
        ).first()
        if conversation:
            msgs = AIMessage.query.filter_by(
                conversation_id=conv_id
            ).order_by(AIMessage.created_at.desc()).limit(6).all()
            history = [{'role': m.role, 'content': m.content} for m in reversed(msgs)]

    # Validate document_id ownership (Teacher RAG — must own the document)
    if doc_id:
        doc = AIDocument.query.filter_by(
            id=doc_id, school_id=school_id, uploaded_by=user.id, status='READY'
        ).first()
        if not doc:
            doc_id = None  # silently ignore invalid doc

    # Process chat
    result = process_chat(
        user_id=user.id,
        role=role,
        school_id=school_id,
        message=message,
        conversation_history=history,
        document_id=doc_id,
    )

    # ─── Persist conversation ────────────────────────────────────────────
    if not result.get('error') or result.get('error') == 'QUOTA_EXCEEDED':
        # Create or get conversation
        if not conversation:
            conversation = AIConversation(
                school_id=school_id,
                user_id=user.id,
                role=role,
                title=message[:80],
                message_count=0,
            )
            db.session.add(conversation)
            db.session.flush()

        # Store user message
        user_msg = AIMessage(
            conversation_id=conversation.id,
            role='user',
            content=message,
            intent=result.get('intent'),
        )
        db.session.add(user_msg)

        # Store assistant response
        if not result.get('error') or result.get('error') not in ('QUOTA_EXCEEDED',):
            asst_msg = AIMessage(
                conversation_id=conversation.id,
                role='assistant',
                content=result.get('answer', ''),
                intent=result.get('intent'),
                cached=result.get('cached', False),
                source=result.get('source'),
                metadata_json=json.dumps({
                    'latency':   result.get('latency', {}),
                    'provider':  result.get('provider'),
                    'model':     result.get('model'),
                }),
            )
            db.session.add(asst_msg)

        conversation.message_count = (conversation.message_count or 0) + 2
        conversation.updated_at    = datetime.utcnow()

        try:
            db.session.commit()
            result['conversation_id'] = conversation.id
        except Exception:
            db.session.rollback()

    return jsonify(result), 200


# ─── /api/ai/usage ───────────────────────────────────────────────────────────

@ai_bp.route('/usage', methods=['GET'])
@jwt_required()
def get_usage():
    """Get current user's daily AI usage."""
    user = _get_user()
    if not user:
        return jsonify({'error': 'Not found'}), 404

    role     = user.role.value if hasattr(user.role, 'value') else str(user.role)
    quota    = check_quota(user.id, role, user.school_id)
    return jsonify({'usage': quota}), 200


# ─── /api/ai/conversations ────────────────────────────────────────────────────

@ai_bp.route('/conversations', methods=['GET'])
@jwt_required()
def get_conversations():
    """List user's recent conversations."""
    user = _get_user()
    if not user:
        return jsonify({'error': 'Not found'}), 404

    convs = AIConversation.query.filter_by(
        user_id=user.id, is_active=True
    ).order_by(AIConversation.updated_at.desc()).limit(20).all()

    return jsonify({'conversations': [c.to_dict() for c in convs]}), 200


@ai_bp.route('/conversations/<int:conv_id>', methods=['GET'])
@jwt_required()
def get_conversation(conv_id):
    """Get a specific conversation with messages. User sees only their own."""
    user = _get_user()
    if not user:
        return jsonify({'error': 'Not found'}), 404

    conv = AIConversation.query.filter_by(
        id=conv_id, user_id=user.id
    ).first()
    if not conv:
        return jsonify({'error': 'Conversation not found'}), 404

    return jsonify(conv.to_dict(include_messages=True)), 200


@ai_bp.route('/conversations/<int:conv_id>', methods=['DELETE'])
@jwt_required()
def delete_conversation(conv_id):
    """Soft-delete a conversation."""
    user = _get_user()
    conv = AIConversation.query.filter_by(id=conv_id, user_id=user.id).first()
    if not conv:
        return jsonify({'error': 'Not found'}), 404
    conv.is_active = False
    db.session.commit()
    return jsonify({'message': 'Deleted'}), 200


# ─── /api/ai/documents (Teacher RAG) ─────────────────────────────────────────

@ai_bp.route('/documents', methods=['GET'])
@jwt_required()
def list_documents():
    """List teacher's uploaded documents."""
    user = _get_user()
    if not user:
        return jsonify({'error': 'Not found'}), 404

    docs = AIDocument.query.filter_by(
        school_id=user.school_id, uploaded_by=user.id
    ).order_by(AIDocument.created_at.desc()).limit(50).all()

    return jsonify({'documents': [d.to_dict() for d in docs]}), 200


@ai_bp.route('/documents/upload', methods=['POST'])
@jwt_required()
def upload_document():
    """Upload a document for RAG. Only teachers can upload."""
    user = _get_user()
    if not user:
        return jsonify({'error': 'Not found'}), 404

    role = user.role.value if hasattr(user.role, 'value') else str(user.role)
    if role not in ('TEACHER', 'PRINCIPAL', 'VICE_PRINCIPAL'):
        return jsonify({'error': 'Only teachers can upload documents'}), 403

    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    f         = request.files['file']
    filename  = f.filename or 'document'
    file_ext  = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''

    # Read file to get size
    file_data = f.read()
    file_size = len(file_data)

    is_valid, err_msg = validate_document(filename, file_size)
    if not is_valid:
        return jsonify({'error': err_msg}), 400

    # Save temporarily
    import tempfile, os
    tmp_dir  = tempfile.mkdtemp()
    tmp_path = os.path.join(tmp_dir, f"doc_{user.id}.{file_ext}")
    with open(tmp_path, 'wb') as tmp:
        tmp.write(file_data)

    # Create DB record
    doc = AIDocument(
        school_id    = user.school_id,
        uploaded_by  = user.id,
        filename     = f"doc_{user.id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.{file_ext}",
        original_name = filename,
        file_type    = file_ext,
        file_size    = file_size,
        subject      = request.form.get('subject', ''),
        class_name   = request.form.get('class_name', ''),
        unit_topic   = request.form.get('unit_topic', ''),
        status       = 'PROCESSING',
    )
    db.session.add(doc)
    db.session.commit()

    # Process (extract + chunk) — in production this should be async
    try:
        chunk_count = process_and_store_document(
            file_path=tmp_path,
            file_type=file_ext,
            document_id=doc.id,
            school_id=user.school_id,
            uploaded_by=user.id,
        )
    except Exception as e:
        doc.status = 'FAILED'
        db.session.commit()
        return jsonify({'error': f'Document processing failed: {str(e)}'}), 500
    finally:
        try:
            os.unlink(tmp_path)
            os.rmdir(tmp_dir)
        except Exception:
            pass

    return jsonify({'document': doc.to_dict(), 'chunk_count': chunk_count}), 201


@ai_bp.route('/documents/<int:doc_id>', methods=['DELETE'])
@jwt_required()
def delete_document(doc_id):
    """Delete a teacher's document."""
    user = _get_user()
    doc  = AIDocument.query.filter_by(id=doc_id, uploaded_by=user.id).first()
    if not doc:
        return jsonify({'error': 'Not found'}), 404
    db.session.delete(doc)
    db.session.commit()
    return jsonify({'message': 'Deleted'}), 200


# ─── Super Admin: AI Configuration ───────────────────────────────────────────

@ai_bp.route('/admin/config', methods=['GET'])
@jwt_required()
def get_ai_config():
    """Get current AI configuration (no API keys returned)."""
    user, err, code = _require_super_admin()
    if err:
        return err, code

    config = AIProviderConfig.query.filter_by(is_active=True).first()
    providers_catalog = [
        {
            'key':    k,
            'label':  v['name'],
            'models': [{'id': m['id'], 'label': m['label']} for m in v['models']],
        }
        for k, v in PROVIDERS.items()
    ]

    return jsonify({
        'config':           config.to_dict_safe() if config else None,
        'providers':        providers_catalog,
        'default_quotas':   DEFAULT_QUOTAS,
    }), 200


@ai_bp.route('/admin/config', methods=['POST'])
@jwt_required()
def save_ai_config():
    """Save/update AI provider configuration."""
    user, err, code = _require_super_admin()
    if err:
        return err, code

    data          = request.get_json() or {}
    provider      = (data.get('provider') or 'GROQ').upper()
    model         = data.get('model', '').strip()
    api_key_plain = data.get('api_key', '').strip()  # Plaintext from form
    temperature   = float(data.get('temperature', 0.3))
    max_tokens    = int(data.get('max_tokens', 800))

    if provider not in PROVIDERS:
        return jsonify({'error': f'Unknown provider: {provider}'}), 400
    if not model:
        return jsonify({'error': 'Model is required'}), 400

    # Deactivate existing configs
    AIProviderConfig.query.update({'is_active': False})

    config = AIProviderConfig.query.first()
    if not config:
        config = AIProviderConfig()
        db.session.add(config)

    config.is_active   = True
    config.provider    = provider
    config.model       = model
    config.temperature = temperature
    config.max_tokens  = max_tokens
    config.updated_by  = user.id
    config.updated_at  = datetime.utcnow()

    if api_key_plain:
        config.encrypted_api_key = encrypt_secret(api_key_plain)
        config.key_configured    = True

    db.session.commit()
    return jsonify({'config': config.to_dict_safe(), 'message': 'AI configuration saved'}), 200


@ai_bp.route('/admin/test-connection', methods=['POST'])
@jwt_required()
def test_connection():
    """Test AI provider connectivity. NOT counted in school quota."""
    user, err, code = _require_super_admin()
    if err:
        return err, code

    data          = request.get_json() or {}
    provider      = (data.get('provider') or 'GROQ').upper()
    model         = data.get('model', '').strip()
    api_key_plain = data.get('api_key', '').strip()

    # If no new key provided, use stored one
    if not api_key_plain:
        config = AIProviderConfig.query.filter_by(is_active=True, provider=provider).first()
        if config and config.encrypted_api_key:
            api_key_plain = decrypt_secret(config.encrypted_api_key)

    if not api_key_plain:
        return jsonify({'success': False, 'message': 'No API key configured'}), 200

    from app.AI.providers.provider_factory import get_provider_for_config
    try:
        provider_obj = get_provider_for_config(provider, model, api_key_plain)
        result       = provider_obj.test_connection()
    except Exception as e:
        result = {'success': False, 'message': 'Connection failed', 'provider': provider}

    return jsonify(result), 200


# ─── Super Admin: Quota Management ───────────────────────────────────────────

@ai_bp.route('/admin/quotas', methods=['GET'])
@jwt_required()
def get_quotas():
    """Get all role quotas."""
    user, err, code = _require_super_admin()
    if err:
        return err, code

    quotas = AIRoleQuota.query.all()
    return jsonify({
        'quotas':         [q.to_dict() for q in quotas],
        'default_quotas': DEFAULT_QUOTAS,
    }), 200


@ai_bp.route('/admin/quotas', methods=['POST'])
@jwt_required()
def set_quota():
    """Set daily quota for a role."""
    user, err, code = _require_super_admin()
    if err:
        return err, code

    data       = request.get_json() or {}
    role       = (data.get('role') or '').upper().strip()
    limit      = int(data.get('daily_limit', 50))
    school_id  = data.get('school_id')  # None = global default

    if not role:
        return jsonify({'error': 'Role is required'}), 400
    if limit < 0 or limit > 10000:
        return jsonify({'error': 'Limit must be 0–10000'}), 400

    # Upsert
    existing = AIRoleQuota.query.filter_by(school_id=school_id, role=role).first()
    if existing:
        existing.daily_limit = limit
        existing.is_active   = True
        existing.updated_at  = datetime.utcnow()
    else:
        quota = AIRoleQuota(school_id=school_id, role=role, daily_limit=limit)
        db.session.add(quota)

    db.session.commit()
    return jsonify({'message': f'{role} quota set to {limit}/day'}), 200


# ─── Super Admin: AI Analytics ────────────────────────────────────────────────

@ai_bp.route('/admin/analytics', methods=['GET'])
@jwt_required()
def get_ai_analytics():
    """
    AI usage analytics for Super Admin.
    Returns aggregated data — NOT individual conversation content.
    """
    user, err, code = _require_super_admin()
    if err:
        return err, code

    from sqlalchemy import func

    today  = date.today()

    # Today's summary
    today_q = db.session.query(
        func.count(AIUsage.id).label('total'),
        func.sum(db.case((AIUsage.cache_hit == True, 1), else_=0)).label('cached'),
        func.sum(db.case((AIUsage.success == True, 1), else_=0)).label('success'),
        func.avg(AIUsage.total_ms).label('avg_ms'),
        func.sum(AIUsage.total_tokens).label('total_tokens'),
        func.sum(AIUsage.estimated_cost).label('total_cost'),
    ).filter(AIUsage.date == today).first()

    # By role
    role_q = db.session.query(
        AIUsage.role,
        func.count(AIUsage.id).label('total'),
    ).filter(AIUsage.date == today).group_by(AIUsage.role).all()

    # By intent
    intent_q = db.session.query(
        AIUsage.intent,
        func.count(AIUsage.id).label('total'),
        func.sum(db.case((AIUsage.cache_hit == True, 1), else_=0)).label('cached'),
    ).filter(AIUsage.date == today)\
     .group_by(AIUsage.intent)\
     .order_by(func.count(AIUsage.id).desc()).limit(10).all()

    # By provider
    provider_q = db.session.query(
        AIUsage.provider,
        func.count(AIUsage.id).label('total'),
        func.avg(AIUsage.total_ms).label('avg_ms'),
    ).filter(AIUsage.date == today, AIUsage.provider != None)\
     .group_by(AIUsage.provider).all()

    # This month
    month_q = db.session.query(
        func.count(AIUsage.id).label('total'),
        func.sum(AIUsage.total_tokens).label('tokens'),
        func.sum(AIUsage.estimated_cost).label('cost'),
    ).filter(
        AIUsage.date >= date(today.year, today.month, 1)
    ).first()

    # Cache stats
    cache_total = AIQueryCache.query.count()
    cache_valid = AIQueryCache.query.filter(
        AIQueryCache.expires_at > datetime.utcnow()
    ).count()

    return jsonify({
        'today': {
            'total_queries':    today_q.total or 0,
            'cached_queries':   today_q.cached or 0,
            'success_queries':  today_q.success or 0,
            'error_queries':    (today_q.total or 0) - (today_q.success or 0),
            'avg_response_ms':  round(float(today_q.avg_ms or 0), 1),
            'cache_hit_rate':   round((today_q.cached or 0) / max(today_q.total or 1, 1) * 100, 1),
            'total_tokens':     today_q.total_tokens or 0,
            'estimated_cost':   round(float(today_q.total_cost or 0), 6),
        },
        'this_month': {
            'total_queries':  month_q.total or 0,
            'total_tokens':   month_q.tokens or 0,
            'estimated_cost': round(float(month_q.cost or 0), 4),
        },
        'by_role':     [{'role': r.role, 'queries': r.total} for r in role_q],
        'by_intent':   [{'intent': i.intent, 'queries': i.total,
                         'cache_hits': i.cached} for i in intent_q],
        'by_provider': [{'provider': p.provider, 'queries': p.total,
                         'avg_ms': round(float(p.avg_ms or 0), 1)} for p in provider_q],
        'cache': {
            'total_entries': cache_total,
            'valid_entries': cache_valid,
        },
    }), 200
