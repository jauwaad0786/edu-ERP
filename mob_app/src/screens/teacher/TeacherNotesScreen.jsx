import React, { useState, useEffect } from 'react';
import { colors } from '../../theme/colors';
import { teacherService } from '../../api/services/teacherService';
import Card from '../../components/common/Card';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import PullToRefresh from '../../components/common/PullToRefresh';

export default function TeacherNotesScreen() {
  const [notes, setNotes] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotes = async () => {
    try {
      setError(null);
      const [notesRes, classesRes] = await Promise.all([
        teacherService.getNotes(),
        teacherService.getClasses(),
      ]);
      setNotes(Array.isArray(notesRes) ? notesRes : []);
      const cls = Array.isArray(classesRes) ? classesRes : [];
      setClasses(cls);
      if (cls.length > 0 && !selectedClass) {
        setSelectedClass(String(cls[0].id));
      }
    } catch (err) {
      setError(err.readableMessage || 'Failed to load study notes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchNotes();
  };

  const handleUpload = async (e) => {
    if (e) e.preventDefault();
    if (!title.trim() || !file) {
      setError('Please provide document title and select a file.');
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('description', desc.trim());
    if (selectedClass) formData.append('class_id', selectedClass);
    formData.append('file', file);

    try {
      await teacherService.uploadNote(formData);
      setTitle('');
      setDesc('');
      setFile(null);
      setShowUploadForm(false);
      await fetchNotes();
    } catch (err) {
      setError(err.readableMessage || 'Failed to upload document.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <LoadingState message="Fetching uploaded materials..." />;

  return (
    <PullToRefresh onRefresh={handleRefresh} refreshing={refreshing}>
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: colors.neutral10, margin: 0 }}>
            Study Materials ({notes.length})
          </h3>
          <Button
            size="sm"
            icon={showUploadForm ? 'ti-x' : 'ti-plus'}
            variant={showUploadForm ? 'secondary' : 'primary'}
            onClick={() => setShowUploadForm(!showUploadForm)}
          >
            {showUploadForm ? 'Cancel' : 'Upload Note'}
          </Button>
        </div>

        {error && <ErrorState message={error} />}

        {/* Upload Form Modal/Card */}
        {showUploadForm && (
          <Card padding="16px" style={{ border: `1.5px solid ${colors.primary}` }}>
            <h4 style={{ fontSize: '14px', fontWeight: 800, color: colors.neutral10, marginBottom: '12px' }}>
              Upload New Study Material
            </h4>
            <form onSubmit={handleUpload}>
              <Input
                label="Document Title"
                placeholder="e.g. Chapter 4 Thermodynamics Notes"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: colors.neutral9, display: 'block', marginBottom: '6px' }}>
                  Target Class
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  style={{
                    width: '100%',
                    height: '42px',
                    borderRadius: '10px',
                    border: `1.5px solid ${colors.border}`,
                    padding: '0 10px',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: colors.neutral10,
                    background: '#fff',
                  }}
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.section ? `(${c.section})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Short Description (Optional)"
                placeholder="Brief summary or instructions"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: colors.neutral9, display: 'block', marginBottom: '6px' }}>
                  Select File (PDF, DOC, PPT, TXT, Images)
                </label>
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files[0])}
                  style={{ fontSize: '12px', width: '100%' }}
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                fullWidth
                loading={uploading}
                icon="ti-upload"
              >
                Upload Document
              </Button>
            </form>
          </Card>
        )}

        {/* Existing Notes List */}
        {notes.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {notes.map((n) => (
              <Card key={n.id} padding="14px">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: colors.errorBg,
                    color: colors.error,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    flexShrink: 0,
                  }}>
                    <i className="ti ti-file-text" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: colors.neutral10 }}>
                      {n.title}
                    </div>
                    {n.description && (
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        {n.description}
                      </div>
                    )}
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                      {n.file_name || 'Document'}
                    </div>
                  </div>
                </div>

                {n.file_url && (
                  <div style={{ marginTop: '10px', borderTop: `1px solid ${colors.divider}`, paddingTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                    <a
                      href={n.file_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: '12px',
                        color: colors.primary,
                        fontWeight: 700,
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <i className="ti ti-external-link" /> Open File
                    </a>
                  </div>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8', fontSize: '13px' }}>
            No study materials uploaded yet. Tap "+ Upload Note" to upload the first document.
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
