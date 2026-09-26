// mob_app/src/screens/library/BooksScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, TextInput, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

export default function BooksScreen({ navigation }) {
  const { user } = useAuth();
  const isLibrarianOrAdmin = ['LIBRARIAN', 'PRINCIPAL', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN'].includes(user?.role);
  const isStudentOrParent = ['STUDENT', 'PARENT', 'TEACHER'].includes(user?.role);

  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCatId, setSelectedCatId] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Student / Teacher My-Library self-service summary
  const [myLibraryData, setMyLibraryData] = useState(null);
  const [showMyLibraryTab, setShowMyLibraryTab] = useState(false);

  // Book Detail Modal
  const [detailModal, setDetailModal] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);
  const [reserving, setReserving] = useState(false);

  // Add Book Modal (Librarian/Admin)
  const [addModal, setAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newIsbn, setNewIsbn] = useState('');
  const [newPublisher, setNewPublisher] = useState('');
  const [newEdition, setNewEdition] = useState('');
  const [newShelf, setNewShelf] = useState('');
  const [newCopies, setNewCopies] = useState('3');
  const [submittingBook, setSubmittingBook] = useState(false);

  // Load Catalog & Categories
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [bRes, cRes] = await Promise.all([
        client.get('/library/books').catch(() => ({ data: [] })),
        client.get('/library/categories').catch(() => ({ data: [] })),
      ]);

      const bList = Array.isArray(bRes.data) ? bRes.data : (bRes.data?.data || bRes.data?.books || []);
      const cList = Array.isArray(cRes.data) ? cRes.data : (cRes.data?.data || []);

      setBooks(bList);
      setCategories(cList);

      // If Student, load my-library data
      if (isStudentOrParent) {
        const myRes = await client.get('/library/my-library').catch(() => null);
        if (myRes?.data) {
          setMyLibraryData(myRes.data);
        }
      }
    } catch {
      // ignore
    } finally {
      if (isRefresh) setRefreshing(false);
      setLoading(false);
    }
  }, [isStudentOrParent]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Reserve Book (Student / Teacher)
  const handleReserveBook = async (bookId) => {
    setReserving(true);
    try {
      await client.post('/library/reservations', { book_id: bookId });
      Alert.alert('Reserved', 'Book reservation registered successfully! You will be notified when a copy is returned.');
      setDetailModal(false);
      loadData(true);
    } catch (err) {
      Alert.alert('Reservation Notice', err?.response?.data?.error || err?.response?.data?.message || 'Could not reserve book.');
    } finally {
      setReserving(false);
    }
  };

  // Handle Add Book (Librarian)
  const handleAddBook = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Required', 'Please enter a book title.');
      return;
    }

    setSubmittingBook(true);
    try {
      await client.post('/library/books', {
        title: newTitle.trim(),
        author: newAuthor.trim(),
        category_id: newCategoryId ? parseInt(newCategoryId, 10) : undefined,
        isbn: newIsbn.trim() || undefined,
        publisher: newPublisher.trim() || undefined,
        edition: newEdition.trim() || undefined,
        shelf_location: newShelf.trim() || undefined,
        total_copies: parseInt(newCopies, 10) || 1,
      });

      Alert.alert('Success', 'Book added to library catalogue!');
      setAddModal(false);
      setNewTitle('');
      setNewAuthor('');
      setNewIsbn('');
      setNewPublisher('');
      setNewEdition('');
      setNewShelf('');
      setNewCopies('3');
      loadData(true);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to add book.');
    } finally {
      setSubmittingBook(false);
    }
  };

  // Filtered Books
  const filteredBooks = books.filter(b => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (b.title || '').toLowerCase().includes(q) ||
      (b.author || '').toLowerCase().includes(q) ||
      (b.isbn || '').toLowerCase().includes(q) ||
      (b.shelf_location || '').toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (selectedCatId !== 'ALL') {
      const bCatId = b.category_id || b.category?.id;
      return String(bCatId) === String(selectedCatId);
    }

    return true;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          {navigation?.canGoBack?.() && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackBtn}>
              <Ionicons name="arrow-back" size={22} color="#ffffff" />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Library Books</Text>
            <Text style={styles.headerSub}>
              {books.length} Books in Collection • {categories.length} Categories
            </Text>
          </View>
        </View>

        {isLibrarianOrAdmin && (
          <TouchableOpacity style={styles.topBtn} onPress={() => setAddModal(true)}>
            <Ionicons name="add-circle" size={16} color="#0891b2" />
            <Text style={styles.topBtnText}>Add Book</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Student/Teacher My-Library Ribbon */}
      {isStudentOrParent && myLibraryData && (
        <View style={styles.myLibraryBar}>
          <TouchableOpacity
            style={styles.myLibrarySummaryBtn}
            onPress={() => setShowMyLibraryTab(v => !v)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="bookmark" size={16} color="#0891b2" />
              <Text style={styles.myLibrarySummaryTitle}>My Borrowed Books</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={styles.myIssuedBadge}>
                <Text style={styles.myIssuedBadgeText}>
                  {myLibraryData.summary?.issued_count || 0} Issued
                </Text>
              </View>
              {myLibraryData.summary?.overdue_count > 0 && (
                <View style={styles.myOverdueBadge}>
                  <Text style={styles.myOverdueBadgeText}>
                    {myLibraryData.summary.overdue_count} Overdue
                  </Text>
                </View>
              )}
              <Ionicons
                name={showMyLibraryTab ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#64748b"
              />
            </View>
          </TouchableOpacity>

          {showMyLibraryTab && (
            <View style={styles.myLibraryExpanded}>
              {myLibraryData.currently_issued?.length === 0 ? (
                <Text style={styles.myEmptyText}>No books currently issued to your account.</Text>
              ) : (
                myLibraryData.currently_issued.map((iss, i) => (
                  <View key={iss.id || i} style={styles.myBookRow}>
                    <Ionicons name="book" size={16} color="#0891b2" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.myBookTitle}>{iss.book?.title || iss.book_title || 'Book'}</Text>
                      <Text style={styles.myBookDue}>Due Date: {iss.due_date || '—'}</Text>
                    </View>
                    <View
                      style={[
                        styles.duePill,
                        iss.overdue_days > 0 ? { backgroundColor: '#fee2e2' } : { backgroundColor: '#dcfce7' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.duePillText,
                          iss.overdue_days > 0 ? { color: '#dc2626' } : { color: '#16a34a' },
                        ]}
                      >
                        {iss.overdue_days > 0 ? `${iss.overdue_days}d OVERDUE` : 'ACTIVE'}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </View>
      )}

      {/* Search & Category Filter Section */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by title, author, ISBN, shelf..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Categories Horizontal Carousel */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
          <TouchableOpacity
            style={[styles.catChip, selectedCatId === 'ALL' && styles.catChipActive]}
            onPress={() => setSelectedCatId('ALL')}
          >
            <Text style={[styles.catChipText, selectedCatId === 'ALL' && styles.catChipTextActive]}>
              All Books
            </Text>
          </TouchableOpacity>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.catChip, String(selectedCatId) === String(cat.id) && styles.catChipActive]}
              onPress={() => setSelectedCatId(String(cat.id))}
            >
              <Text style={[styles.catChipText, String(selectedCatId) === String(cat.id) && styles.catChipTextActive]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Main Catalog Content */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#0891b2" />
          <Text style={styles.loadingText}>Fetching library books...</Text>
        </View>
      ) : filteredBooks.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={['#0891b2']} />}
        >
          <Ionicons name="book-outline" size={48} color="#94a3b8" />
          <Text style={styles.emptyTitle}>No Books Found</Text>
          <Text style={styles.emptySub}>
            {search ? 'No books match your search keyword.' : 'Catalogue is currently empty.'}
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ padding: 16, paddingBottom: 50 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={['#0891b2']} />}
          showsVerticalScrollIndicator={false}
        >
          {filteredBooks.map((b, idx) => {
            const avail = b.available_copies ?? b.available_count ?? 1;
            const total = b.total_copies ?? b.copies_count ?? 1;
            const isAvail = avail > 0;

            return (
              <TouchableOpacity
                key={b.id || idx}
                style={styles.bookCard}
                onPress={() => {
                  setSelectedBook(b);
                  setDetailModal(true);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.bookCardTop}>
                  <View style={styles.bookIconCircle}>
                    <Ionicons name="book" size={22} color="#0891b2" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bookTitle}>{b.title}</Text>
                    <Text style={styles.bookAuthor}>By {b.author || 'Unknown Author'}</Text>
                    <View style={styles.metaRow}>
                      <View style={styles.categoryPill}>
                        <Text style={styles.categoryPillText}>
                          {b.category?.name || b.category_name || 'General'}
                        </Text>
                      </View>
                      {b.shelf_location ? (
                        <Text style={styles.shelfText}>Rack: {b.shelf_location}</Text>
                      ) : null}
                    </View>
                  </View>

                  <View
                    style={[
                      styles.availBadge,
                      isAvail ? { backgroundColor: '#dcfce7' } : { backgroundColor: '#fee2e2' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.availBadgeText,
                        isAvail ? { color: '#16a34a' } : { color: '#dc2626' },
                      ]}
                    >
                      {isAvail ? `${avail} Avail` : 'ISSUED'}
                    </Text>
                  </View>
                </View>

                {b.isbn ? (
                  <View style={styles.bookCardFooter}>
                    <Text style={styles.isbnText}>ISBN: {b.isbn}</Text>
                    <Text style={styles.copiesText}>
                      {avail} of {total} copies available
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Book Detail & Reserve Modal */}
      <Modal
        visible={detailModal}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.modalTitle}>{selectedBook?.title}</Text>
                <Text style={styles.modalSub}>By {selectedBook?.author || 'Unknown Author'}</Text>
              </View>
              <TouchableOpacity onPress={() => setDetailModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              <View style={styles.detailGrid}>
                <View style={styles.detailBox}>
                  <Text style={styles.detailBoxLabel}>CATEGORY</Text>
                  <Text style={styles.detailBoxVal}>
                    {selectedBook?.category?.name || selectedBook?.category_name || 'General'}
                  </Text>
                </View>
                <View style={styles.detailBox}>
                  <Text style={styles.detailBoxLabel}>SHELF / RACK</Text>
                  <Text style={styles.detailBoxVal}>{selectedBook?.shelf_location || 'Main Section'}</Text>
                </View>
                <View style={styles.detailBox}>
                  <Text style={styles.detailBoxLabel}>ISBN NUMBER</Text>
                  <Text style={styles.detailBoxVal}>{selectedBook?.isbn || '—'}</Text>
                </View>
                <View style={styles.detailBox}>
                  <Text style={styles.detailBoxLabel}>COPIES STATUS</Text>
                  <Text
                    style={[
                      styles.detailBoxVal,
                      { color: (selectedBook?.available_copies ?? 1) > 0 ? '#16a34a' : '#dc2626' },
                    ]}
                  >
                    {selectedBook?.available_copies ?? 1} Available
                  </Text>
                </View>
              </View>

              {selectedBook?.publisher && (
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.detailBoxLabel}>PUBLISHER & EDITION</Text>
                  <Text style={styles.publisherText}>
                    {selectedBook.publisher} {selectedBook.edition ? `(${selectedBook.edition})` : ''}
                  </Text>
                </View>
              )}

              {/* Reserve action for students & teachers */}
              {isStudentOrParent && (
                <TouchableOpacity
                  style={[styles.reserveBtn, reserving && { opacity: 0.7 }]}
                  onPress={() => handleReserveBook(selectedBook?.id)}
                  disabled={reserving}
                >
                  {reserving ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="bookmark" size={18} color="#ffffff" />
                      <Text style={styles.reserveBtnText}>Reserve This Book</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Book Modal (Librarian/Admin) */}
      <Modal
        visible={addModal}
        animationType="slide"
        transparent
        onRequestClose={() => setAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Add Book to Library</Text>
                <Text style={styles.modalSub}>Catalogue new book with barcodes</Text>
              </View>
              <TouchableOpacity onPress={() => setAddModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>BOOK TITLE *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Concept of Physics Vol 1"
                placeholderTextColor="#94a3b8"
                value={newTitle}
                onChangeText={setNewTitle}
              />

              <Text style={styles.inputLabel}>AUTHOR</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Dr. H. C. Verma"
                placeholderTextColor="#94a3b8"
                value={newAuthor}
                onChangeText={setNewAuthor}
              />

              <Text style={styles.inputLabel}>CATEGORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {categories.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.catSelectChip, String(newCategoryId) === String(c.id) && styles.catSelectChipActive]}
                    onPress={() => setNewCategoryId(String(c.id))}
                  >
                    <Text style={[styles.catSelectText, String(newCategoryId) === String(c.id) && styles.catSelectTextActive]}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>ISBN NUMBER</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="978-0-123456"
                    placeholderTextColor="#94a3b8"
                    value={newIsbn}
                    onChangeText={setNewIsbn}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>COPIES TO ADD</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="3"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    value={newCopies}
                    onChangeText={setNewCopies}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>PUBLISHER</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. Bharati Bhawan"
                    placeholderTextColor="#94a3b8"
                    value={newPublisher}
                    onChangeText={setNewPublisher}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>SHELF / RACK</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. Rack A-12"
                    placeholderTextColor="#94a3b8"
                    value={newShelf}
                    onChangeText={setNewShelf}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, submittingBook && { opacity: 0.7 }]}
                onPress={handleAddBook}
                disabled={submittingBook}
              >
                {submittingBook ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                    <Text style={styles.submitBtnText}>Catalogue Book</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0891b2',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerBackBtn: {
    padding: 4,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  headerSub: {
    fontSize: 11,
    color: '#cffafe',
    marginTop: 1,
  },
  topBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  topBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0891b2',
  },
  myLibraryBar: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  myLibrarySummaryBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  myLibrarySummaryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  myIssuedBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  myIssuedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369a1',
  },
  myOverdueBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  myOverdueBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626',
  },
  myLibraryExpanded: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  myEmptyText: {
    fontSize: 12,
    color: '#94a3b8',
    paddingVertical: 8,
    fontStyle: 'italic',
  },
  myBookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  myBookTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  myBookDue: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  duePill: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  duePillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  searchSection: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    paddingVertical: 2,
  },
  catScroll: {
    marginVertical: 10,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
  },
  catChipActive: {
    backgroundColor: '#0891b2',
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  catChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748b',
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    marginTop: 14,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
  },
  bookCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bookCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  bookIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  bookAuthor: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  categoryPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  shelfText: {
    fontSize: 11,
    color: '#0891b2',
    fontWeight: '600',
  },
  availBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  availBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  bookCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 10,
    paddingTop: 8,
  },
  isbnText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  copiesText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  detailBox: {
    width: '48%',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
  },
  detailBoxLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.3,
  },
  detailBoxVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  publisherText: {
    fontSize: 13,
    color: '#334155',
    marginTop: 2,
  },
  reserveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0891b2',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 18,
    marginBottom: 10,
  },
  reserveBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.3,
    marginBottom: 6,
    marginTop: 8,
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 10,
  },
  catSelectChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  catSelectChipActive: {
    backgroundColor: '#0891b2',
    borderColor: '#0891b2',
  },
  catSelectText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  catSelectTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0891b2',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 14,
    marginBottom: 20,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
});
