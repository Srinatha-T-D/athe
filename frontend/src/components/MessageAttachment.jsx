import React from 'react';

export default function MessageAttachment({ url, type, name }) {
  if (!url) return null;

  if (type === 'image') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mb-1.5">
        <img
          src={url}
          alt={name || 'attachment'}
          loading="lazy"
          className="max-w-full max-h-64 rounded-lg object-cover"
        />
      </a>
    );
  }

  if (type === 'audio') {
    return (
      <audio controls preload="none" className="max-w-full mb-1.5" style={{ height: '36px', width: '220px' }}>
        <source src={url} />
      </audio>
    );
  }

  return null;
}
