#!/usr/bin/env node
const fs = require('fs');
const https = require('https');

// Get Railway token from config
const token = (() => {
  try {
    const config = JSON.parse(fs.readFileSync('/Users/aliasgarfatepurwala/.railway/config.json', 'utf8'));
    return config.accessToken;
  } catch (e) {
    console.error('Error reading token:', e.message);
    return null;
  }
})();

if (!token) {
  console.error('❌ No Railway token found');
  process.exit(1);
}

console.log('✅ Found Railway token');
console.log('🚀 Testing Railway API connection...\n');

// Simple test query
const query = '{ viewer { id } }';

const postData = JSON.stringify({ query });

const options = {
  hostname: 'api.railway.app',
  path: '/graphql',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      if (result.data?.viewer?.id) {
        console.log('✅ Railway API authenticated successfully');
        console.log(`   User ID: ${result.data.viewer.id}`);
        
        // Now try to get projects
        console.log('\n🔍 Fetching projects...');
        
        const projectsQuery = '{ projects(input: {}) { edges { node { id name } } } }';
        const projectsPostData = JSON.stringify({ query: projectsQuery });
        
        const options2 = {
          hostname: 'api.railway.app',
          path: '/graphql',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(projectsPostData)
          }
        };
        
        const req2 = https.request(options2, (res2) => {
          let data2 = '';
          res2.on('data', chunk => data2 += chunk);
          res2.on('end', () => {
            try {
              const result2 = JSON.parse(data2);
              if (result2.data?.projects?.edges) {
                const projects = result2.data.projects.edges;
                console.log(`\n✅ Found ${projects.length} projects:`);
                projects.forEach(p => {
                  console.log(`   - ${p.node.name} (ID: ${p.node.id})`);
                });
              } else {
                console.log('Response:', JSON.stringify(result2, null, 2));
              }
            } catch (e) {
              console.error('Parse error:', e.message);
            }
          });
        });
        
        req2.on('error', e => console.error('Request error:', e));
        req2.write(projectsPostData);
        req2.end();
        
      } else {
        console.error('❌ Authentication failed');
        console.error('Response:', data);
      }
    } catch (e) {
      console.error('Parse error:', e.message);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ API request failed:', e.message);
  process.exit(1);
});

req.write(postData);
req.end();
