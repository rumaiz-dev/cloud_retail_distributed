import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const failureRate = new Rate('failed_requests');

export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Ramp up to 50 users
    { duration: '1m', target: 100 },  // Stay at 100 users
    { duration: '30s', target: 200 }, // Ramp up to 200 users
    { duration: '1m', target: 200 },  // Stay at 200 users
    { duration: '30s', target: 0 },   // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    failed_requests: ['rate<0.1'],    // Less than 10% failure rate
  },
};

const BASE_URL = 'http://api-gateway:3000';
let authToken = '';

export function setup() {
  // Login to get token
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, {
    email: 'test@example.com',
    password: 'password123'
  });
  
  const loginData = JSON.parse(loginRes.body);
  authToken = loginData.token;
  
  return { token: authToken };
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`
  };

  // Test different endpoints
  const endpoints = [
    '/api/products',
    '/api/profile',
    '/api/orders'
  ];

  const randomEndpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.get(`${BASE_URL}${randomEndpoint}`, { headers });

  // Check response
  const checkRes = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  // Record failure
  failureRate.add(!checkRes);

  sleep(1); // Wait 1 second between requests
}

export function teardown(data) {
  // Cleanup if needed
  console.log('Load test completed');
}