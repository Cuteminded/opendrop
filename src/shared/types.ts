export type Runtime = 'android' | 'linux' | 'windows';
export type Mode = 'device' | 'demo';
export type JobStatus =
  'queued' | 'uploading' | 'registering' | 'installed' | 'failed' | 'cancelled';

export interface Candidate {
  path: string;
  runtime: Runtime;
}
export interface Build {
  id: string;
  name: string;
  source: string;
  bytes: number;
  fileCount: number;
  candidates: Candidate[];
  warnings: string[];
}
export interface Device {
  host: string;
  port: number;
  name: string;
  username?: string;
  fingerprint?: string;
}
export interface Job {
  id: string;
  name: string;
  runtime: Runtime;
  entrypoint: string;
  bytes: number;
  transferred: number;
  status: JobStatus;
  error?: string;
  device: string;
  mode: Mode;
  createdAt: string;
  gameId: string;
}
export interface LogEntry {
  time: string;
  message: string;
  level: 'info' | 'error';
}
export interface AppState {
  mode: Mode;
  devices: Device[];
  connected?: Device;
  jobs: Job[];
  logs: LogEntry[];
  busy?: string;
  pendingUrl?: string;
}
export interface InstallRequest {
  buildId: string;
  name: string;
  entrypoint: string;
}
export interface OpenDropApi {
  state(): Promise<AppState>;
  subscribe(callback: (state: AppState) => void): () => void;
  mode(mode: Mode): Promise<void>;
  discover(): Promise<void>;
  connect(host: string, port: number, pair: boolean): Promise<void>;
  disconnect(): Promise<void>;
  pick(folder: boolean): Promise<Build | null>;
  inspect(path: string): Promise<Build>;
  filePath(file: File): string;
  demoBuild(): Promise<Build>;
  download(url: string): Promise<Build>;
  install(request: InstallRequest): Promise<void>;
  cancel(id: string): Promise<void>;
  launch(id: string): Promise<void>;
  discard(id: string): Promise<void>;
}

export const runtimeLabels: Record<Runtime, string> = {
  android: 'Android APK',
  linux: 'Linux ARM64',
  windows: 'Windows',
};
