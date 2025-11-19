// Quick test to verify Supabase realtime is working
// Run with: node test-supabase.js

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://rnxcjullrjwhgtdbpqbp.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_MNW6PjTAceTc2WO1P0Lpmg_ZQdBhuz4';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJueGNqdWxscmp3aGd0ZGJwcWJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MjkxMzEsImV4cCI6MjA3ODEwNTEzMX0.B4nEarvTZFFDWztLbZnLfELuCBVQYOyTGX1veEulIsk';

async function test() {
  console.log('Testing Supabase realtime connection...\n');

  // Test 1: Service role key (backend)
  console.log('1. Testing service role key (backend)...');
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    realtime: {
      params: {
        apikey: SUPABASE_SERVICE_KEY,
        eventsPerSecond: 10,
      },
    },
  });

  const serviceChannel = serviceClient.channel('test-channel-service');

  serviceChannel.on('broadcast', { event: 'test' }, (msg) => {
    console.log('Service client received:', msg);
  });

  await new Promise((resolve) => {
    serviceChannel.subscribe((status) => {
      console.log(`Service client status: ${status}`);
      if (status === 'SUBSCRIBED') resolve();
    });
  });

  // Test 2: Anon key (frontend)
  console.log('\n2. Testing anon key (frontend)...');
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });

  const anonChannel = anonClient.channel('test-channel-anon');

  anonChannel.on('broadcast', { event: 'test' }, (msg) => {
    console.log('Anon client received:', msg);
  });

  await new Promise((resolve) => {
    anonChannel.subscribe((status) => {
      console.log(`Anon client status: ${status}`);
      if (status === 'SUBSCRIBED') resolve();
    });
  });

  // Test 3: Send broadcast from anon to service
  console.log('\n3. Testing broadcast from anon to service...');
  const result = await anonChannel.send({
    type: 'broadcast',
    event: 'test',
    payload: { message: 'Hello from anon client!' },
  });
  console.log('Broadcast result:', result);

  // Wait a bit to see if message arrives
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\nTest complete!');
  process.exit(0);
}

test().catch(console.error);