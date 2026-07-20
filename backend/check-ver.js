const { fetchLatestBaileysVersion } = require('baileys');
const axios = require('axios');

async function run() {
  console.log('--- Fetching via fetchLatestBaileysVersion() ---');
  try {
    const baileysVer = await fetchLatestBaileysVersion();
    console.log('Baileys version object:', baileysVer);
  } catch (err) {
    console.error('Error fetching Baileys version:', err);
  }

  console.log('\n--- Fetching sw.js to check client_revision ---');
  try {
    const { data } = await axios.get('https://web.whatsapp.com/sw.js', {
      responseType: 'text'
    });
    
    const regex = /"client_revision":\s*(\d+)/;
    const match = data.match(regex);
    console.log('Regex match with standard quotes:', match ? match[0] : 'No match found');
    console.log('Matched revision:', match ? match[1] : 'N/A');

    const regexEscaped = /\\"client_revision\\":\s*(\d+)/;
    const matchEscaped = data.match(regexEscaped);
    console.log('Regex match with escaped quotes:', matchEscaped ? matchEscaped[0] : 'No match found');

    console.log('First 500 chars of sw.js:', data.slice(0, 500));
  } catch (err) {
    console.error('Error fetching sw.js:', err);
  }
}

run();
