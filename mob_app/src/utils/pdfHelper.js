// mob_app/src/utils/pdfHelper.js
import { Alert, Linking, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as SecureStore from 'expo-secure-store';
import client from '../api/client';

/**
 * Resolves full API URL with token query parameter for webview / browser fallback.
 */
export async function getAuthenticatedPdfUrl(pathOrUrl) {
  let fullUrl = pathOrUrl || '';
  const baseUrl = (client.defaults.baseURL || 'https://edu-erp-backend-xoas.onrender.com/api').replace(/\/+$/, '');

  if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
    const cleanPath = fullUrl.startsWith('/') ? fullUrl : `/${fullUrl}`;
    fullUrl = `${baseUrl}${cleanPath}`;
  }

  const token = await SecureStore.getItemAsync('access_token').catch(() => null);
  if (token && !fullUrl.includes('token=')) {
    const separator = fullUrl.includes('?') ? '&' : '?';
    fullUrl = `${fullUrl}${separator}token=${encodeURIComponent(token)}`;
  }

  return { fullUrl, token };
}

/**
 * Downloads authenticated PDF bytes into local cache directory,
 * verifying that the response is a valid 200 PDF and not an auth / JSON error.
 */
export async function downloadPdfLocally(pathOrUrl, filename = 'document.pdf') {
  const { fullUrl, token } = await getAuthenticatedPdfUrl(pathOrUrl);
  const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  const localUri = `${FileSystem.cacheDirectory}${Date.now()}_${safeFilename}`;

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const downloadRes = await FileSystem.downloadAsync(fullUrl, localUri, { headers });

  if (downloadRes.status !== 200) {
    try {
      await FileSystem.deleteAsync(downloadRes.uri, { idempotent: true });
    } catch {}
    if (downloadRes.status === 401 || downloadRes.status === 403) {
      throw new Error('Your session has expired or you do not have permission to access this document. Please log in again.');
    } else if (downloadRes.status === 404) {
      throw new Error('The requested document was not found on the server.');
    } else {
      throw new Error(`Failed to download document (HTTP ${downloadRes.status}).`);
    }
  }

  // Validate that the file is not an empty or JSON error response
  try {
    const fileInfo = await FileSystem.getInfoAsync(downloadRes.uri);
    if (!fileInfo.exists || fileInfo.size === 0) {
      await FileSystem.deleteAsync(downloadRes.uri, { idempotent: true });
      throw new Error('Received an empty document from the server.');
    }

    if (fileInfo.size < 300) {
      // Check if it's a JSON error payload
      const content = await FileSystem.readAsStringAsync(downloadRes.uri, {
        encoding: FileSystem.EncodingType.UTF8,
        length: 200,
      }).catch(() => '');
      if (content.trim().startsWith('{') && content.includes('"error"')) {
        await FileSystem.deleteAsync(downloadRes.uri, { idempotent: true });
        try {
          const parsed = JSON.parse(content);
          throw new Error(parsed.error || 'Server error while generating document.');
        } catch (e) {
          throw new Error(e.message || 'Server error while generating document.');
        }
      }
    }
  } catch (chkErr) {
    if (chkErr.message.includes('Server') || chkErr.message.includes('session') || chkErr.message.includes('permission')) {
      throw chkErr;
    }
  }

  return { uri: downloadRes.uri, fullUrl, safeFilename };
}

/**
 * Downloads PDF to local cache with Bearer Auth headers and opens system Share dialog.
 * Works seamlessly on Android (FileProvider content-URI) and iOS (native ShareSheet).
 */
export async function downloadAndSharePdf(pathOrUrl, filename = 'document.pdf', title = 'Document') {
  try {
    const { uri, fullUrl, safeFilename } = await downloadPdfLocally(pathOrUrl, filename);

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: title || safeFilename,
        UTI: 'com.adobe.pdf',
      });
      return uri;
    } else {
      // Fallback: Open URL directly in external browser with token
      await Linking.openURL(fullUrl);
      return uri;
    }
  } catch (err) {
    console.warn('[pdfHelper] downloadAndSharePdf error:', err);
    Alert.alert('Download Error', err.message || 'Unable to download or share this document.');
    return null;
  }
}

/**
 * Prints PDF directly using native AirPrint (iOS) or Android Print Spooler.
 */
export async function printPdf(pathOrUrl, filename = 'document.pdf', title = 'Print Document') {
  try {
    const { uri, safeFilename } = await downloadPdfLocally(pathOrUrl, filename);
    await Print.printAsync({ uri });
    return true;
  } catch (err) {
    console.warn('[pdfHelper] printPdf error:', err);
    // If native print spooler is unavailable or errors, offer share/save dialog
    return downloadAndSharePdf(pathOrUrl, filename, title);
  }
}

/**
 * Interactive action picker to View, Print, or Save/Share financial documents.
 */
export function handlePdfActionMenu({ pathOrUrl, filename = 'document.pdf', title = 'Document Options' }) {
  if (!pathOrUrl) {
    Alert.alert('Notice', 'Document link is not available.');
    return;
  }

  Alert.alert(
    title,
    'Choose an action for this document:',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Print Document',
        onPress: () => printPdf(pathOrUrl, filename, title),
      },
      {
        text: 'Save / Share PDF',
        onPress: () => downloadAndSharePdf(pathOrUrl, filename, title),
      },
    ]
  );
}

export default {
  getAuthenticatedPdfUrl,
  downloadPdfLocally,
  downloadAndSharePdf,
  printPdf,
  handlePdfActionMenu,
};
