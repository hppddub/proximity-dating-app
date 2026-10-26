import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'tests/e2e',timeout:65000,fullyParallel:false,workers:1,
  use:{baseURL:'http://127.0.0.1:8790',headless:true},
  webServer:{command:'npm start',url:'http://127.0.0.1:8790/health',reuseExistingServer:false,env:{HOST:'127.0.0.1',PORT:'8790',DEMO_MODE:'true',DB_PATH:':memory:'}},
  reporter:'list',outputDir:'artifacts/playwright'
});
