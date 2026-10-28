import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('reports ok', () => {
    const result = new HealthController().check();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('coach-connect-api');
  });
});
