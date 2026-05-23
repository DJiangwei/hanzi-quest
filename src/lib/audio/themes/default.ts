import { playBuzz, playDing, playFanfare } from '../sounds';
import type { ThemeHandlers } from './index';

export const defaultTheme: ThemeHandlers = {
  ding: playDing,
  buzz: playBuzz,
  fanfare: playFanfare,
};
