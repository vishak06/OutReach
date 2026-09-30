import { createApp } from './app';
import { config } from './config';

const app = createApp();

app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);

  if (config.runWorkerInApi) {
    void import('./worker').then(() => {
      console.log('BullMQ worker is running inside the API process');
    });
  }
});

