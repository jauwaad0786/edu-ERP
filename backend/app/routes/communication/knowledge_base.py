from flask import Blueprint, request, jsonify
from app import db
from app.models.user import User, UserRole
from app.models.communication import KnowledgeBase
from app.utils.decorators import role_required, get_current_user
from datetime import datetime
from app.utils.timezone_util import utc_now
import cloudinary.uploader

knowledge_base_bp = Blueprint('knowledge_base', __name__)


# ─── 1. Create Article (SUPER_ADMIN only) ────────────────────────────────────

@knowledge_base_bp.route('', methods=['POST'])
@role_required('SUPER_ADMIN')
def create_article():
    """
    POST /api/support/kb
    Body: {
        title, body, article_type,
        tags, module_name, product_type,
        video_url, is_published
    }
    article_type: ARTICLE | FAQ | VIDEO | PDF_MANUAL
    tags: comma-separated — "fees,generate,class"
    """
    user = get_current_user()
    data = request.get_json() or {}

    title = (data.get('title') or '').strip()
    body  = (data.get('body')  or '').strip()

    if not title:
        return jsonify({'error': 'title is required'}), 400
    if not body:
        return jsonify({'error': 'body is required'}), 400

    article = KnowledgeBase(
        product_type = data.get('product_type', 'EduERP'),
        created_by   = user.id,
        title        = title,
        body         = body,
        article_type = (data.get('article_type') or 'ARTICLE').upper(),
        video_url    = data.get('video_url') or None,
        tags         = data.get('tags', ''),
        module_name  = data.get('module_name', ''),
        is_published = bool(data.get('is_published', True)),
        views        = 0,
    )
    db.session.add(article)
    db.session.commit()
    return jsonify(article.to_dict()), 201


# ─── 2. List Articles ─────────────────────────────────────────────────────────

@knowledge_base_bp.route('', methods=['GET'])
@role_required('SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL',
               'TEACHER', 'STUDENT', 'PARENT',
               'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN',
               'HOSTEL', 'TRANSPORT', 'HR')
def list_articles():
    """
    GET /api/support/kb
    Query params: product_type, article_type, module_name,
                  search, page, per_page
    - SUPER_ADMIN: published + unpublished sab dekhe
    - Others: sirf published articles
    """
    user = get_current_user()
    q    = KnowledgeBase.query

    # Non-admin sirf published dekhe
    if user.role != UserRole.SUPER_ADMIN:
        q = q.filter_by(is_published=True)

    # Filters
    if request.args.get('product_type'):
        q = q.filter_by(product_type=request.args.get('product_type'))
    if request.args.get('article_type'):
        q = q.filter_by(article_type=request.args.get('article_type').upper())
    if request.args.get('module_name'):
        q = q.filter_by(module_name=request.args.get('module_name'))

    # Search — title, tags, module_name mein
    search = (request.args.get('search') or '').strip()
    if search:
        like = f'%{search}%'
        q = q.filter(
            db.or_(
                KnowledgeBase.title.ilike(like),
                KnowledgeBase.tags.ilike(like),
                KnowledgeBase.module_name.ilike(like),
                KnowledgeBase.body.ilike(like),
            )
        )

    page     = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 100)

    paginated = q.order_by(
        KnowledgeBase.views.desc(),
        KnowledgeBase.created_at.desc()
    ).paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'data':     [a.to_dict() for a in paginated.items],
        'total':    paginated.total,
        'page':     paginated.page,
        'pages':    paginated.pages,
        'has_next': paginated.has_next,
    }), 200


# ─── 3. Article Detail ────────────────────────────────────────────────────────

@knowledge_base_bp.route('/<int:article_id>', methods=['GET'])
@role_required('SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL',
               'TEACHER', 'STUDENT', 'PARENT',
               'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN',
               'HOSTEL', 'TRANSPORT', 'HR')
def article_detail(article_id):
    """
    GET /api/support/kb/<id>
    Article detail + views auto increment.
    """
    user    = get_current_user()
    article = KnowledgeBase.query.get_or_404(article_id)

    # Unpublished sirf SUPER_ADMIN dekh sakta hai
    if not article.is_published and user.role != UserRole.SUPER_ADMIN:
        return jsonify({'error': 'Article not found'}), 404

    # Views increment
    article.views += 1
    db.session.commit()

    return jsonify(article.to_dict()), 200


# ─── 4. Update Article (SUPER_ADMIN only) ────────────────────────────────────

@knowledge_base_bp.route('/<int:article_id>', methods=['PATCH'])
@role_required('SUPER_ADMIN')
def update_article(article_id):
    """
    PATCH /api/support/kb/<id>
    Body: any field to update
    """
    article = KnowledgeBase.query.get_or_404(article_id)
    data    = request.get_json() or {}

    if data.get('title')        is not None: article.title        = data['title'].strip()
    if data.get('body')         is not None: article.body         = data['body'].strip()
    if data.get('article_type') is not None: article.article_type = data['article_type'].upper()
    if data.get('tags')         is not None: article.tags         = data['tags']
    if data.get('module_name')  is not None: article.module_name  = data['module_name']
    if data.get('product_type') is not None: article.product_type = data['product_type']
    if data.get('video_url')    is not None: article.video_url    = data['video_url'] or None
    if 'is_published' in data:               article.is_published = bool(data['is_published'])

    article.updated_at = utc_now()
    db.session.commit()
    return jsonify(article.to_dict()), 200


# ─── 5. Delete Article (SUPER_ADMIN only) ────────────────────────────────────

@knowledge_base_bp.route('/<int:article_id>', methods=['DELETE'])
@role_required('SUPER_ADMIN')
def delete_article(article_id):
    """DELETE /api/support/kb/<id>"""
    article = KnowledgeBase.query.get_or_404(article_id)
    db.session.delete(article)
    db.session.commit()
    return jsonify({'message': 'Article deleted'}), 200


# ─── 6. Toggle Publish (SUPER_ADMIN only) ────────────────────────────────────

@knowledge_base_bp.route('/<int:article_id>/publish', methods=['POST'])
@role_required('SUPER_ADMIN')
def toggle_publish(article_id):
    """
    POST /api/support/kb/<id>/publish
    Publish ya unpublish toggle karo.
    """
    article              = KnowledgeBase.query.get_or_404(article_id)
    article.is_published = not article.is_published
    article.updated_at   = utc_now()
    db.session.commit()
    return jsonify({
        'message':      'Published' if article.is_published else 'Unpublished',
        'is_published': article.is_published,
    }), 200


# ─── 7. Popular Articles (dashboard widget) ───────────────────────────────────

@knowledge_base_bp.route('/popular', methods=['GET'])
@role_required('SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL',
               'TEACHER', 'STUDENT', 'PARENT',
               'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN',
               'HOSTEL', 'TRANSPORT', 'HR')
def popular_articles():
    """
    GET /api/support/kb/popular?product_type=EduERP&limit=5
    Most viewed published articles — support page widget ke liye.
    """
    product_type = request.args.get('product_type', 'EduERP')
    limit        = min(request.args.get('limit', 5, type=int), 20)

    articles = KnowledgeBase.query.filter_by(
        is_published = True,
        product_type = product_type,
    ).order_by(
        KnowledgeBase.views.desc()
    ).limit(limit).all()

    return jsonify([a.to_dict() for a in articles]), 200


# ─── 8. By Module (module-wise grouping) ──────────────────────────────────────

@knowledge_base_bp.route('/by-module', methods=['GET'])
@role_required('SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL',
               'TEACHER', 'STUDENT', 'PARENT',
               'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN',
               'HOSTEL', 'TRANSPORT', 'HR')
def by_module():
    """
    GET /api/support/kb/by-module?product_type=EduERP
    Module-wise article count + top article.
    Help Center homepage ke liye.
    """
    from sqlalchemy import func

    product_type = request.args.get('product_type', 'EduERP')

    # Module-wise count
    rows = db.session.query(
        KnowledgeBase.module_name,
        func.count(KnowledgeBase.id).label('count'),
    ).filter_by(
        is_published = True,
        product_type = product_type,
    ).group_by(
        KnowledgeBase.module_name
    ).order_by(
        func.count(KnowledgeBase.id).desc()
    ).all()

    result = []
    for r in rows:
        # Har module ka top article (most viewed)
        top = KnowledgeBase.query.filter_by(
            module_name  = r.module_name,
            product_type = product_type,
            is_published = True,
        ).order_by(KnowledgeBase.views.desc()).first()

        result.append({
            'module_name':   r.module_name or 'General',
            'article_count': r.count,
            'top_article': {
                'id':    top.id,
                'title': top.title,
                'views': top.views,
            } if top else None,
        })

    return jsonify(result), 200


# ─── 9. Upload PDF Manual (SUPER_ADMIN only) ──────────────────────────────────

@knowledge_base_bp.route('/<int:article_id>/upload-pdf', methods=['POST'])
@role_required('SUPER_ADMIN')
def upload_pdf(article_id):
    """
    POST /api/support/kb/<id>/upload-pdf
    multipart/form-data — field: 'file' (PDF only)
    PDF manual Cloudinary pe upload karo aur article se link karo.
    """
    article = KnowledgeBase.query.get_or_404(article_id)
    file    = request.files.get('file')

    if not file:
        return jsonify({'error': 'file required — field name: file'}), 400

    content_type = file.content_type or ''
    if 'pdf' not in content_type:
        return jsonify({'error': 'Sirf PDF file allowed hai'}), 400

    result = cloudinary.uploader.upload(
        file,
        folder        = 'eduerp/knowledge_base',
        resource_type = 'raw',   # PDF ke liye raw type
        overwrite     = True,
        public_id     = f'kb_article_{article_id}',
    )

    article.file_url     = result['secure_url']
    article.article_type = 'PDF_MANUAL'
    article.updated_at   = utc_now()
    db.session.commit()

    return jsonify({
        'message':  'PDF uploaded',
        'file_url': article.file_url,
        'article':  article.to_dict(),
    }), 200
