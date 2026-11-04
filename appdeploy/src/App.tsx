import { useEffect, useRef, useState } from 'react';
import { api, auth } from '@appdeploy/client';
import {
  AudioLines,
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  CloudUpload,
  Download,
  FileAudio,
  Fingerprint,
  Headphones,
  LockKeyhole,
  LogIn,
  LogOut,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  WandSparkles,
  Waves,
  X,
  Zap,
} from 'lucide-react';

type Job = {
  id: string;
  status: string;
  stage: string;
  progress: number;
  error?: string;
};
type Account = { email?: string; name?: string };
const MAX_FILE = 12 * 1024 * 1024;
const CHUNK_SIZE = 720 * 1024;
const allowed = [
  'mp3',
  'wav',
  'm4a',
  'flac',
  'ogg',
  'aac',
  'opus',
  'aiff',
  'wma',
];
function prettySize(bytes: number) {
  return bytes >= 1048576
    ? (bytes / 1048576).toFixed(1) + ' MB'
    : (bytes / 1024).toFixed(0) + ' KB';
}
function fileValid(file: File) {
  return (
    allowed.includes((file.name.split('.').pop() || '').toLowerCase()) &&
    file.size > 0 &&
    file.size <= MAX_FILE
  );
}
function readPart(part: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(new Error('Could not read audio file'));
    r.readAsDataURL(part);
  });
}
function FilePanel({
  type,
  title,
  subtitle,
  file,
  onFile,
  number,
}: {
  type: 'source' | 'target';
  title: string;
  subtitle: string;
  file: File | null;
  onFile: (file: File | null) => void;
  number: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!file) {
      setUrl('');
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  const select = (f?: File) => {
    if (f) onFile(f);
  };
  return (
    <section
      className={
        'upload-panel ' + (drag ? 'dragged ' : '') + (file ? 'has-file' : '')
      }
    >
      <div className="panel-heading">
        <div className="step-badge">{number}</div>
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>
      <input
        ref={input}
        className="visually-hidden"
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg,.aac,.opus,.aiff,.wma"
        onChange={e => select(e.target.files?.[0])}
      />
      {!file ? (
        <div
          className="dropzone"
          role="button"
          tabIndex={0}
          aria-label={'Choose ' + type + ' audio file'}
          onClick={() => input.current?.click()}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              input.current?.click();
            }
          }}
          onDragOver={e => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => {
            e.preventDefault();
            setDrag(false);
            select(e.dataTransfer.files?.[0]);
          }}
        >
          <div className="drop-icon">
            {type === 'source' ? (
              <CloudUpload size={27} />
            ) : (
              <Fingerprint size={27} />
            )}
          </div>
          <div className="drop-title">
            Drop audio here or <span>browse files</span>
          </div>
          <div className="drop-hint">
            MP3, WAV, M4A, FLAC and more · Max 12 MB
          </div>
        </div>
      ) : (
        <div className="selected-file">
          <div className="file-top">
            <span className="file-icon">
              <FileAudio size={22} />
            </span>
            <span className="file-details">
              <strong title={file.name}>{file.name}</strong>
              <small>{prettySize(file.size)} · Ready to preview</small>
            </span>
            <button
              className="icon-button"
              aria-label={'Remove ' + type + ' audio'}
              title="Remove file"
              onClick={() => {
                onFile(null);
                if (input.current) input.current.value = '';
              }}
            >
              <X size={17} />
            </button>
          </div>
          <div className="wave-strip" aria-hidden="true">
            {Array.from({ length: 47 }, (_, i) => (
              <span
                key={i}
                style={{ height: 14 + ((i * 41 + 19) % 72) + '%' }}
              />
            ))}
          </div>
          {url && (
            <audio
              controls
              preload="metadata"
              src={url}
              aria-label={'Preview ' + type + ' audio'}
            />
          )}
          <button
            className="replace-link"
            onClick={() => input.current?.click()}
          >
            <RefreshCw size={14} /> Replace recording
          </button>