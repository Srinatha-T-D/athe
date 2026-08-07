import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

// Mirrors the server-side whitelist in backend/server.py (ALLOWED_MEDIA_TYPES)
// so the user gets instant feedback instead of waiting on a round trip -
// the server re-validates regardless, this is just UX, not the real guard.
export const ACCEPTED_MEDIA_TYPES =
  'image/jpeg,image/png,image/gif,image/webp,audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/x-m4a';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

export function useMediaUpload() {
  const { axiosAuth } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const uploadFile = useCallback(async (file) => {
    setError(null);

    const isAudio = file.type.startsWith('audio/');
    const isImage = file.type.startsWith('image/');
    if (!isAudio && !isImage) {
      const msg = 'Only images, gifs, and audio clips are supported.';
      setError(msg);
      throw new Error(msg);
    }
    const limit = isAudio ? MAX_AUDIO_BYTES : MAX_IMAGE_BYTES;
    if (file.size > limit) {
      const msg = `File too large. Max ${Math.round(limit / (1024 * 1024))}MB for ${isAudio ? 'audio' : 'images'}.`;
      setError(msg);
      throw new Error(msg);
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      // Content-Type is intentionally NOT set manually here - the browser
      // needs to generate it itself (including the multipart boundary) from
      // the FormData object; a hardcoded header here would break the upload.
      const res = await axiosAuth().post('/media/upload', formData);
      return res.data; // { url, attachment_type, attachment_name, size }
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Upload failed, please try again.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setUploading(false);
    }
  }, [axiosAuth]);

  return { uploadFile, uploading, error, setError };
}
