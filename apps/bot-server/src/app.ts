import type { AppConfig } from '@bot-momo/config';

export type AppStatus = {
  service: 'bot-server';
  ready: true;
  config: {
    provider: AppConfig['defaultProvider'];
    botName: string;
    activeReplyEnabled: boolean;
  };
};

export function createAppStatus(config: AppConfig): AppStatus {
  return {
    service: 'bot-server',
    ready: true,
    config: {
      provider: config.defaultProvider,
      botName: config.botName,
      activeReplyEnabled: config.activeReplyEnabled,
    },
  };
}
