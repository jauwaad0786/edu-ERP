/**
 * 1P360 BOT — Frontend API Service
 * All AI calls go through this single file.
 * Uses the existing axios instance (JWT auto-attached).
 */
import api from '../../api/axios';

const BASE = '/ai';

// ─── Chat ──────────────────────────────────────────────────────────────────

export const sendMessage = async ({ message, conversation_id, document_id }) => {
  const { data } = await api.post(`${BASE}/chat`, {
    message,
    conversation_id,
    document_id,
  });
  return data;
};

export const getUsage = async () => {
  const { data } = await api.get(`${BASE}/usage`);
  return data.usage;
};

// ─── Conversations ─────────────────────────────────────────────────────────

export const getConversations = async () => {
  const { data } = await api.get(`${BASE}/conversations`);
  return data.conversations;
};

export const getConversation = async (id) => {
  const { data } = await api.get(`${BASE}/conversations/${id}`);
  return data;
};

export const deleteConversation = async (id) => {
  await api.delete(`${BASE}/conversations/${id}`);
};

// ─── Documents ─────────────────────────────────────────────────────────────

export const listDocuments = async () => {
  const { data } = await api.get(`${BASE}/documents`);
  return data.documents;
};

export const uploadDocument = async (file, meta = {}) => {
  const form = new FormData();
  form.append('file', file);
  if (meta.subject)    form.append('subject', meta.subject);
  if (meta.class_name) form.append('class_name', meta.class_name);
  if (meta.unit_topic) form.append('unit_topic', meta.unit_topic);

  const { data } = await api.post(`${BASE}/documents/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const deleteDocument = async (id) => {
  await api.delete(`${BASE}/documents/${id}`);
};

// ─── Super Admin ───────────────────────────────────────────────────────────

export const getAIConfig = async () => {
  const { data } = await api.get(`${BASE}/admin/config`);
  return data;
};

export const saveAIConfig = async (config) => {
  const { data } = await api.post(`${BASE}/admin/config`, config);
  return data;
};

export const testConnection = async ({ provider, model, api_key }) => {
  const { data } = await api.post(`${BASE}/admin/test-connection`, {
    provider,
    model,
    api_key,
  });
  return data;
};

export const getQuotas = async () => {
  const { data } = await api.get(`${BASE}/admin/quotas`);
  return data;
};

export const setQuota = async ({ role, daily_limit, school_id }) => {
  const { data } = await api.post(`${BASE}/admin/quotas`, {
    role,
    daily_limit,
    school_id,
  });
  return data;
};

export const getAIAnalytics = async () => {
  const { data } = await api.get(`${BASE}/admin/analytics`);
  return data;
};
