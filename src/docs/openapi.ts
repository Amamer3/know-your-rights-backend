export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'KnowYourRights GH API',
    version: '1.0.0',
    description: 'API documentation for authentication, legal resources, and assessments.',
  },
  servers: [
    {
      url: 'https://know-your-rights-backend.onrender.com',
      description: 'Production',
    },
    {
      url: 'http://localhost:3000',
      description: 'Local',
    },
  ],
  tags: [
    { name: 'Auth' },
    { name: 'User' },
    { name: 'Legal' },
    { name: 'Assessments' },
    { name: 'Saved' },
    { name: 'Admin' },
    { name: 'Health' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        responses: {
          '200': {
            description: 'Service is healthy',
          },
        },
      },
    },
    '/api/auth/signup': {
      post: {
        tags: ['Auth'],
        summary: 'Sign up a new user',
        responses: {
          '201': { description: 'User registered successfully' },
          '400': { description: 'Invalid request' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in with email and password',
        responses: {
          '200': { description: 'Login successful' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Log out user',
        responses: {
          '200': { description: 'Logout successful' },
        },
      },
    },
    '/api/auth/google': {
      get: {
        tags: ['Auth'],
        summary: 'Start Google OAuth flow',
        responses: {
          '200': { description: 'Google login initiated' },
        },
      },
    },
    '/api/auth/callback': {
      get: {
        tags: ['Auth'],
        summary: 'Google OAuth callback',
        responses: {
          '200': { description: 'Deep link handoff page' },
        },
      },
    },
    '/api/auth/profile': {
      get: {
        tags: ['Auth'],
        summary: 'Get profile (auth alias)',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'User profile' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/user/profile': {
      get: {
        tags: ['User'],
        summary: 'Get authenticated user profile',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'User profile' },
        },
      },
      put: {
        tags: ['User'],
        summary: 'Update authenticated user profile',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Profile updated' },
        },
      },
    },
    '/api/user/account': {
      delete: {
        tags: ['User'],
        summary: 'Delete authenticated user account',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Account deleted' },
        },
      },
    },
    '/api/legal/constitution': {
      get: {
        tags: ['Legal'],
        summary: 'Get constitution content',
        responses: {
          '200': { description: 'Constitution returned' },
        },
      },
    },
    '/api/legal/articles/{id}': {
      get: {
        tags: ['Legal'],
        summary: 'Get constitution article by id',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': { description: 'Article returned' },
          '404': { description: 'Article not found' },
        },
      },
    },
    '/api/legal/emergency-actions': {
      get: {
        tags: ['Legal'],
        summary: 'Get emergency legal actions',
        responses: {
          '200': { description: 'Emergency actions returned' },
        },
      },
    },
    '/api/legal/search': {
      get: {
        tags: ['Legal'],
        summary: 'Search legal resources',
        parameters: [
          {
            name: 'query',
            in: 'query',
            required: false,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': { description: 'Search results returned' },
        },
      },
    },
    '/api/assess': {
      post: {
        tags: ['Assessments'],
        summary: 'Submit an assessment',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Assessment submitted' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/assess/history': {
      get: {
        tags: ['Assessments'],
        summary: 'Get assessment history',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'History returned' },
        },
      },
    },
    '/api/assess/{id}': {
      get: {
        tags: ['Assessments'],
        summary: 'Get assessment by id',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': { description: 'Assessment returned' },
        },
      },
    },
    '/api/saved': {
      get: {
        tags: ['Saved'],
        summary: 'Get saved items',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Saved items returned' },
        },
      },
      post: {
        tags: ['Saved'],
        summary: 'Save an item',
        security: [{ bearerAuth: [] }],
        responses: {
          '201': { description: 'Item saved' },
        },
      },
    },
    '/api/saved/{id}': {
      delete: {
        tags: ['Saved'],
        summary: 'Remove saved item',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': { description: 'Item removed' },
        },
      },
    },
    '/api/admin/stats': {
      get: {
        tags: ['Admin'],
        summary: 'Get admin dashboard stats',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Dashboard stats returned' },
          '403': { description: 'Admin access denied' },
        },
      },
    },
    '/api/admin/bootstrap': {
      post: {
        tags: ['Admin'],
        summary: 'Bootstrap first admin account (one-time)',
        description:
          'Requires authenticated user token and x-admin-bootstrap-secret header. Works only if no admin exists yet.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'x-admin-bootstrap-secret',
            in: 'header',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': { description: 'Admin bootstrap successful' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Invalid bootstrap secret' },
          '409': { description: 'Admin already bootstrapped' },
        },
      },
    },
    '/api/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'List users for admin dashboard',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { name: 'search', in: 'query', required: false, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Users returned' },
          '403': { description: 'Admin access denied' },
        },
      },
    },
    '/api/admin/users/{userId}': {
      get: {
        tags: ['Admin'],
        summary: 'Get single user details for admin',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'User details returned' },
          '404': { description: 'User not found' },
        },
      },
      patch: {
        tags: ['Admin'],
        summary: 'Update user profile fields as admin',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'User updated' },
          '400': { description: 'Invalid update request' },
          '403': { description: 'Admin access denied' },
        },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Delete user data as admin',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'User data deleted' },
          '403': { description: 'Admin access denied' },
        },
      },
    },
    '/api/admin/assessments': {
      get: {
        tags: ['Admin'],
        summary: 'List all assessments',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { name: 'userId', in: 'query', required: false, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Assessments returned' },
          '403': { description: 'Admin access denied' },
        },
      },
    },
    '/api/admin/assessments/{assessmentId}': {
      delete: {
        tags: ['Admin'],
        summary: 'Delete an assessment',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'assessmentId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Assessment deleted' },
          '403': { description: 'Admin access denied' },
        },
      },
    },
    '/api/admin/articles': {
      get: {
        tags: ['Admin'],
        summary: 'List constitution articles (admin)',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Articles returned' },
          '403': { description: 'Admin access denied' },
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Create constitution article',
        security: [{ bearerAuth: [] }],
        responses: {
          '201': { description: 'Article created' },
          '400': { description: 'Invalid request' },
          '403': { description: 'Admin access denied' },
        },
      },
    },
    '/api/admin/articles/{articleId}': {
      patch: {
        tags: ['Admin'],
        summary: 'Update constitution article',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'articleId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Article updated' },
          '400': { description: 'Invalid request' },
          '403': { description: 'Admin access denied' },
        },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Delete constitution article',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'articleId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Article deleted' },
          '403': { description: 'Admin access denied' },
        },
      },
    },
    '/api/admin/emergency-actions': {
      get: {
        tags: ['Admin'],
        summary: 'List emergency actions (admin)',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Emergency actions returned' },
          '403': { description: 'Admin access denied' },
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Create emergency action',
        security: [{ bearerAuth: [] }],
        responses: {
          '201': { description: 'Emergency action created' },
          '400': { description: 'Invalid request' },
          '403': { description: 'Admin access denied' },
        },
      },
    },
    '/api/admin/emergency-actions/{actionId}': {
      patch: {
        tags: ['Admin'],
        summary: 'Update emergency action',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'actionId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Emergency action updated' },
          '400': { description: 'Invalid request' },
          '403': { description: 'Admin access denied' },
        },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Delete emergency action',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'actionId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Emergency action deleted' },
          '403': { description: 'Admin access denied' },
        },
      },
    },
    '/api/admin/upload': {
      post: {
        tags: ['Admin'],
        summary: 'Upload constitution PDF',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'PDF processed successfully' },
          '400': { description: 'No file uploaded' },
          '403': { description: 'Admin access denied' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
      },
    },
  },
} as const;
