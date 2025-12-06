/**
 * Download F1 backgrounds from Wikimedia Commons
 * Uses the Wikimedia API to find and download CC-licensed F1 photos
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '..', 'src', 'renderer', 'assets', 'backgrounds');

// User agent for Wikimedia API (required)
const USER_AGENT = 'GrandPrixUniverse/1.0 (https://github.com/wpinrui/grand-prix-universe; contact@example.com)';

// Fetch JSON from URL
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: {
        'User-Agent': USER_AGENT
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON parse error: ${data.substring(0, 100)}`));
        }
      });
    }).on('error', reject);
  });
}

// Download file from URL
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: {
        'User-Agent': USER_AGENT
      }
    };

    https.get(options, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(destPath);
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (e) => {
      fs.unlink(destPath, () => {});
      reject(e);
    });
  });
}

// Search for images on Wikimedia Commons
async function searchImages(searchTerm, limit = 10) {
  const encoded = encodeURIComponent(searchTerm);
  const url = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&srnamespace=6&srlimit=${limit}&format=json`;
  const data = await fetchJson(url);

  if (!data.query || !data.query.search) return [];

  return data.query.search
    .map(item => item.title)
    .filter(title => /\.(jpg|jpeg|png)$/i.test(title));
}

// Get image URL from title
async function getImageUrl(title) {
  const encoded = encodeURIComponent(title);
  const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encoded}&prop=imageinfo&iiprop=url&iiurlwidth=1920&format=json`;
  const data = await fetchJson(url);

  if (!data.query || !data.query.pages) return null;

  const pages = Object.values(data.query.pages);
  if (pages.length === 0 || !pages[0].imageinfo) return null;

  // Prefer thumbnail at 1920px, fall back to original
  return pages[0].imageinfo[0].thumburl || pages[0].imageinfo[0].url;
}

// Download images for a team
async function downloadTeamImages(searchTerm, teamFolder, count = 5) {
  console.log(`\n=== ${teamFolder}: searching '${searchTerm}' ===`);

  const destDir = path.join(BASE_DIR, teamFolder);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  try {
    const titles = await searchImages(searchTerm, count + 5); // Get extra in case some fail
    let downloaded = 0;

    for (let i = 0; i < titles.length && downloaded < count; i++) {
      const title = titles[i];
      console.log(`  [${downloaded + 1}] ${title}`);

      try {
        const url = await getImageUrl(title);
        if (!url) {
          console.log(`      -> No URL found, skipping`);
          continue;
        }

        const ext = path.extname(title).toLowerCase() || '.jpg';
        const destPath = path.join(destDir, `${String(downloaded + 1).padStart(2, '0')}${ext}`);

        await downloadFile(url, destPath);
        const stats = fs.statSync(destPath);
        console.log(`      -> Downloaded (${Math.round(stats.size / 1024)}KB)`);
        downloaded++;
      } catch (e) {
        console.log(`      -> Failed: ${e.message}`);
      }
    }

    console.log(`  Downloaded ${downloaded}/${count} images`);
  } catch (e) {
    console.log(`  Error: ${e.message}`);
  }
}

async function main() {
  console.log('Downloading F1 backgrounds from Wikimedia Commons...');
  console.log(`Destination: ${BASE_DIR}`);

  // Team-specific searches (targeting recent F1 cars)
  const teams = [
    { search: 'Ferrari SF-24 OR Ferrari SF-23 OR Scuderia Ferrari Formula 1', folder: 'ferrari' },
    { search: 'McLaren MCL38 OR McLaren MCL35 Lando Norris', folder: 'mclaren' },
    { search: 'Mercedes AMG F1 W15 OR Mercedes W14 Lewis Hamilton', folder: 'mercedes' },
    { search: 'Red Bull RB20 OR Red Bull RB19 Max Verstappen', folder: 'red-bull-racing' },
    { search: 'Williams FW46 OR Williams FW45 Formula 1', folder: 'williams' },
    { search: 'Alpine A524 OR Alpine A523 Formula 1', folder: 'alpine' },
    { search: 'Aston Martin AMR24 OR Aston Martin AMR23 Formula 1', folder: 'aston-martin' },
    { search: 'Haas VF-24 OR Haas VF-23 Formula 1', folder: 'haas' },
    { search: 'Sauber C44 OR Alfa Romeo C43 Formula 1', folder: 'kick-sauber' },
    { search: 'AlphaTauri AT04 OR VCARB 01 Formula 1', folder: 'racing-bulls' },
  ];

  for (const team of teams) {
    await downloadTeamImages(team.search, team.folder, 5);
  }

  // Generic F1 photos for fallback
  await downloadTeamImages('Formula 1 Grand Prix 2024 racing', 'generic', 10);

  console.log('\n=== Done! ===');

  // Summary
  console.log('\nSummary:');
  const folders = fs.readdirSync(BASE_DIR);
  for (const folder of folders) {
    const folderPath = path.join(BASE_DIR, folder);
    if (fs.statSync(folderPath).isDirectory()) {
      const files = fs.readdirSync(folderPath).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
      console.log(`  ${folder}: ${files.length} images`);
    }
  }
}

main().catch(console.error);
