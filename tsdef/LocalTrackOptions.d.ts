import { LogLevel } from './Members';
import { LogLevels } from './LogLevels';

export interface LocalTrackOptions {
  logLevel: LogLevel | LogLevels;
  name?: string;
}
