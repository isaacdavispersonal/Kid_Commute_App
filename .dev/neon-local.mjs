import { neonConfig } from '@neondatabase/serverless';

neonConfig.useSecureWebSocket = false;
neonConfig.forceDisablePgSSL = true;
neonConfig.pipelineTLS = false;
neonConfig.pipelineConnect = false;
neonConfig.wsProxy = (host) => `${host}:5433/v2`;
