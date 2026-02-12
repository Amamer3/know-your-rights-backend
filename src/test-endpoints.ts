import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const API_URL = 'http://localhost:3000/api';
let authToken = '';
let userId = '';

const testEndpoints = async () => {
  console.log('Starting API Endpoint Tests...\n');

  try {
    // 1. Health Check
    console.log('--- Testing Health Check ---');
    const health = await axios.get('http://localhost:3000/health');
    console.log('Health Check:', health.data.status);

    // 2. Auth: Signup
    console.log('\n--- Testing Auth: Signup ---');
    const testEmail = `test${Math.floor(Math.random() * 100000)}@gmail.com`;
    const testPassword = 'Password123!';
    try {
      const signup = await axios.post(`${API_URL}/auth/signup`, {
        email: testEmail,
        password: testPassword,
        name: 'Test User'
      });
      console.log('Signup Successful');
    } catch (error: any) {
      console.log('Signup Failed:', error.response?.data?.message || error.message);
    }

    // 2b. Auth: Duplicate Signup Check
    console.log('\n--- Testing Auth: Duplicate Signup ---');
    try {
      await axios.post(`${API_URL}/auth/signup`, {
        email: testEmail,
        password: testPassword,
        name: 'Test User'
      });
      console.log(' Duplicate Signup Failed: Allowed same email twice');
    } catch (error: any) {
      console.log(' Duplicate Signup Prevention Successful:', error.response?.data?.message);
    }

    // 3. Auth: Login
    console.log('\n--- Testing Auth: Login ---');
    let refreshToken = '';
    try {
      const login = await axios.post(`${API_URL}/auth/login`, {
        email: testEmail,
        password: testPassword
      });
      authToken = login.data.data.session.access_token;
      refreshToken = login.data.data.session.refresh_token;
      userId = login.data.data.user.id;
      console.log(' Login Successful');
    } catch (error: any) {
      console.log(' Login Failed:', error.response?.data?.message || error.message);
      console.log('⚠️  Note: If "Email not confirmed" occurs, you need to disable "Confirm Email" in Supabase Auth Settings.');
    }

    // 3b. Auth: Google Login Initiation
    console.log('\n--- Testing Auth: Google Login Initiation ---');
    try {
      const google = await axios.get(`${API_URL}/auth/google`);
      if (google.data.url) {
        console.log('Google Login Initiation Successful. URL found.');
      } else {
        console.log('Google Login Initiation Failed: No URL returned');
      }
    } catch (error: any) {
      console.log('Google Login Initiation Failed:', error.response?.data?.message || error.message);
    }

    const authHeader = authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : null;

    // 3b. Auth: Refresh Token
    if (refreshToken) {
      console.log('\n--- Testing Auth: Refresh Token ---');
      try {
        const refresh = await axios.post(`${API_URL}/auth/refresh`, {
          refresh_token: refreshToken
        });
        console.log(' Token Refresh Successful');
      } catch (error: any) {
        console.log(' Token Refresh Failed:', error.response?.data?.message || error.message);
      }
    }

    // 3c. Auth: Forgot Password
    console.log('\n--- Testing Auth: Forgot Password ---');
    try {
      await axios.post(`${API_URL}/auth/forgot-password`, {
        email: testEmail
      });
      console.log(' Forgot Password Email Sent');
    } catch (error: any) {
      console.log(' Forgot Password Failed:', error.response?.data?.message || error.message);
    }

    // 4. User: Get Profile
      if (authHeader) {
        console.log('\n--- Testing User: Get Profile ---');
        try {
          // Test both endpoints (main and alias)
          const profile = await axios.get(`${API_URL}/user/profile`, authHeader);
          const aliasProfile = await axios.get(`${API_URL}/auth/profile`, authHeader);
          
          const name = profile.data.data.full_name || profile.data.data.user_metadata?.full_name;
          console.log('Get Profile Successful (Main). Name:', name);
          console.log('Get Profile Successful (Alias).');

          // 4b. User: Update Profile
          console.log('\n--- Testing User: Update Profile ---');
          const update = await axios.put(`${API_URL}/user/profile`, {
            name: 'Updated Test User',
            preferences: { theme: 'dark' }
          }, authHeader);
          console.log('Update Profile Successful. New Name:', update.data.data.full_name);
        } catch (error: any) {
          console.log('User Profile Tests Failed:', error.response?.data?.message || error.message);
        }
      } else {
      console.log('\nSkipping User Profile test (No Auth Token)');
    }

    // 5. Legal: Get Articles
    console.log('\n--- Testing Legal: Get Articles ---');
    let articleId = '';
    try {
      const articles = await axios.get(`${API_URL}/legal/constitution`);
      console.log(`Get Constitution Successful: Found ${articles.data.data.length} articles`);
      if (articles.data.data.length > 0) {
        articleId = articles.data.data[0].id;
        console.log(`   Sample Article: ${articles.data.data[0].article_title}`);
      } else {
        console.log('   No articles found in the database. Did you upload the PDF successfully?');
      }
    } catch (error: any) {
        console.log('Get Constitution Failed:', error.response?.data?.message || error.message);
      }

      // 5b. Legal: Search
      console.log('\n--- Testing Legal: Search ---');
      try {
        const search = await axios.get(`${API_URL}/legal/search?query=rights`);
        console.log(`Search Successful: Found ${search.data.data.length} results for "rights"`);
      } catch (error: any) {
        console.log('Search Failed:', error.response?.data?.message || error.message);
      }

      // 5c. Legal: Emergency Actions
      console.log('\n--- Testing Legal: Emergency Actions ---');
      try {
        const emergency = await axios.get(`${API_URL}/legal/emergency-actions`);
        console.log(`Get Emergency Actions Successful: Found ${emergency.data.data.length} actions`);
      } catch (error: any) {
        console.log('Get Emergency Actions Failed:', error.response?.data?.message || error.message);
      }

      // 6. AI: Submit Assessment (Public Fallback Check)
      console.log('\n--- Testing AI: Submit Assessment ---');
      let assessmentId = '';
      if (authHeader) {
        try {
          const assessment = await axios.post(`${API_URL}/assess`, {
            description: 'What are my rights during a police search in Ghana?'
          }, authHeader);
          assessmentId = assessment.data.data.id;
          console.log('AI Assessment Successful');
        } catch (error: any) {
          console.log('AI Assessment Failed:', error.response?.data?.message || error.message);
        }

        // 6b. AI: History
        console.log('\n--- Testing AI: History ---');
        try {
          const history = await axios.get(`${API_URL}/assess/history`, authHeader);
          console.log(`Assessment History Successful: Found ${history.data.data.length} records`);
        } catch (error: any) {
          console.log('Assessment History Failed:', error.response?.data?.message || error.message);
        }

        // 6c. AI: Detail
        if (assessmentId) {
          console.log('\n--- Testing AI: Detail ---');
          try {
            const detail = await axios.get(`${API_URL}/assess/${assessmentId}`, authHeader);
            console.log('Assessment Detail Successful:', detail.data.data.description.substring(0, 30) + '...');
          } catch (error: any) {
            console.log('Assessment Detail Failed:', error.response?.data?.message || error.message);
          }
        }
      } else {
        console.log('Skipping token-based AI tests as Login is blocked.');
      }

      // 7. Saved Resources Flow
      if (authHeader && articleId) {
        console.log('\n--- Testing Saved Resources Flow ---');
        let savedId = '';
        try {
          // Save
          const save = await axios.post(`${API_URL}/saved`, {
            resource_id: articleId,
            resource_type: 'article',
            title: 'Test Saved Article',
            content: 'This is a test content'
          }, authHeader);
          savedId = save.data.data.id;
          console.log('Save Resource Successful');

          // Get
          const list = await axios.get(`${API_URL}/saved`, authHeader);
          console.log(`Get Saved Resources Successful: Found ${list.data.data.length} items`);

          // Delete
          if (savedId) {
            await axios.delete(`${API_URL}/saved/${savedId}`, authHeader);
            console.log('Delete Saved Resource Successful');
          }
        } catch (error: any) {
          console.log(' Saved Resources Flow Failed:', error.response?.data?.message || error.message);
        }
      } else {
        console.log('\n Skipping Saved Resources Flow (No Auth Token or Article ID)');
      }

      // 8. Auth: Logout
      if (authHeader) {
        console.log('\n--- Testing Auth: Logout ---');
        try {
          await axios.post(`${API_URL}/auth/logout`, {}, authHeader);
          console.log(' Logout Successful');
        } catch (error: any) {
          console.log(' Logout Failed:', error.response?.data?.message || error.message);
        }
      }

      // 9. User: Delete Account
      // Note: We'll skip this by default to avoid deleting our test user if needed, 
      // but let's test it at the very end of everything.
      if (authHeader) {
        console.log('\n--- Testing User: Delete Account ---');
        try {
          // We need a fresh login because we just logged out
          const login = await axios.post(`${API_URL}/auth/login`, {
            email: testEmail,
            password: 'Password123!'
          });
          const freshAuthHeader = { headers: { Authorization: `Bearer ${login.data.data.session.access_token}` } };
          
          await axios.delete(`${API_URL}/user/account`, freshAuthHeader);
          console.log(' Delete Account Successful');
        } catch (error: any) {
          console.log(' Delete Account Failed:', error.response?.data?.message || error.message);
        }
      }

      console.log('\n Test run finished');

  } catch (error: any) {
      console.error('\nCritical Test Error:', error.response?.data || error.message);
    }
};

testEndpoints();
