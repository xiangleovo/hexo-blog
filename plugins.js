#!/usr/bin/env node
/**
 * plugins.js
 * 用于下载 Hexo 主题 Solitude 中第三方的插件文件。
 * 该脚本会读取主题目录下的 plugins.yml 文件，解析其中的插件信息，
 * 并从 CDN 上下载相应的文件到指定的本地目录。
 * node plugins.js
 */

// 变量
const isNPM = false; // 是否是 NPM 安装
const foderName = 'plugins'; // 存储文件夹名称

// 模块
const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const https = require('https');

const THEME_DIR = isNPM ? path.join(__dirname, 'node_modules', 'hexo-theme-solitude') : path.join(__dirname, 'themes', 'solitude');
const PLUGIN_FILE = path.join(THEME_DIR, 'plugins.yml');
const OUTPUT_DIR = path.join(__dirname, 'themes', 'solitude', 'source', 'libs');

function parsePluginsYml(text) {
  const res = {};
  let cur = null;
  text.split(/\r?\n/).forEach(l => {
    const ln = l.split('#')[0].trimEnd();
    if (!ln) return;
    const sec = ln.match(/^([a-zA-Z0-9_\-]+):\s*$/);
    if (sec) {
      cur = sec[1];
      res[cur] = {};
      return;
    }
    const kv = ln.match(/^  ([a-zA-Z0-9_\-]+):\s*(.*)$/);
    if (kv && cur) {
      res[cur][kv[1]] = kv[2].trim();
    }
  });
  return res;
}

async function mkdirp(d) {
  try {
    await fsPromises.mkdir(d, { recursive: true });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
}

function fetch(url, dest) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      // 处理重定向
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.destroy();
        return fetch(response.headers.location, dest).then(resolve, reject);
      }

      if (response.statusCode !== 200) {
        response.destroy();
        return reject(new Error(`${response.statusCode} ${url}`));
      }

      const fileStream = fs.createWriteStream(dest);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close(resolve);
      });

      fileStream.on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

function minFile(f) {
  return f.replace(/(?<!\.min)\.(js|css)$/i, '.min.$1');
}

(async () => {
  try {
    const pluginsText = await fsPromises.readFile(PLUGIN_FILE, 'utf8');
    const plugins = parsePluginsYml(pluginsText);
    await mkdirp(OUTPUT_DIR);

    for (const [key, def] of Object.entries(plugins)) {
      if (!def.name || !def.file || !def.version) {
        console.warn(`[SKIP] ${key} 缺少 name/file/version`);
        continue;
      }

      const { name, file, version, other_name } = def;
      
      const dirName = `${other_name || name}@${version}`;

      const url = `https://cdnjs.cloudflare.com/ajax/libs/${other_name || name}/${version}/${minFile(file.replace(/^[lib|dist]*\/|browser\//g, ''))}`;
      
      const dest = path.join(OUTPUT_DIR, dirName, file);
      
      try {
        await fsPromises.access(dest);
        console.log(`[SKIP] ${key}`);
        continue;
      } catch (e) {
        if (e.code !== 'ENOENT') {
          console.error(`[ERROR] ${key} 访问文件失败: ${e.message}`);
          continue;
        }
      }

      console.log(`[DOWN] ${key} → ${dest}`);
      try {
        await mkdirp(path.dirname(dest));
        await fetch(url, dest);
        console.log(`[OK]   ${key}`);
      } catch (e) {
        console.error(`[FAIL] ${key}: ${e.message}`);
      }
    }
    console.log('全部完成！');
  } catch (error) {
    console.error(`脚本执行失败: ${error.message}`);
  }
})();