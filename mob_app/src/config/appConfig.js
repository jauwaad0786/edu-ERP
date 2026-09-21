// Central application configuration
export const appConfig = {
  appName: 'Edu ERP',
  appTitle: 'School & College Management System',
  version: '1.0.0',
  buildNumber: 1,
  releaseDate: '2026-09-18',
  defaultSession: '2025-2026',
  supportEmail: 'support@eduerp.cloud',
  website: 'https://eduerp.cloud',
  company: 'Edu ERP Cloud Inc.',
  
  // Environments
  environments: {
    DEVELOPMENT: {
      name: 'Development',
      apiUrl: 'http://10.0.2.2:5000/api', // Android emulator localhost alias
    },
    STAGING: {
      name: 'Staging',
      apiUrl: 'https://edu-erp-staging.onrender.com/api',
    },
    PRODUCTION: {
      name: 'Production',
      apiUrl: 'https://edu-erp-backend-xoas.onrender.com/api',
    },
  },
  
  currentEnvironment: 'PRODUCTION',
};
