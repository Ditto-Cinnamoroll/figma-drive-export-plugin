const SETTINGS_KEY = 'drive-export-settings-v1';

const DEFAULT_SETTINGS = {
  googleClientId: '',
  googleClientSecret: '',
  allowedEmailDomains: '',
  targets: {
    android: true,
    ios: true,
    web: true
  },
  android: {
    mdpi: '',
    hdpi: '',
    xhdpi: '',
    xxhdpi: '',
    xxxhdpi: ''
  },
  iosFolder: '',
  webFolder: ''
};

const ANDROID_SCALES = [
  { key: 'mdpi', scale: 1 },
  { key: 'hdpi', scale: 1.5 },
  { key: 'xhdpi', scale: 2 },
  { key: 'xxhdpi', scale: 3 },
  { key: 'xxxhdpi', scale: 4 }
];

figma.showUI(__html__, { width: 520, height: 760 });

init();

let authFlowActive = false;

function parseAllowedDomains(raw) {
  if (!raw) return [];
  return raw
    .split(/[,\n;\s]+/)
    .map((v) => v.trim().toLowerCase().replace(/^@+/, ''))
    .filter(Boolean);
}

function isEmailAllowed(email, allowedDomains) {
  const lowerEmail = (email || '').toLowerCase();
  if (!lowerEmail.includes('@')) return false;
  const domain = lowerEmail.split('@').pop();
  return allowedDomains.includes(domain);
}

function toFormBody(obj) {
  return Object.keys(obj)
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]))
    .join('&');
}

async function startDeviceAuth(settings) {
  if (authFlowActive) {
    figma.ui.postMessage({
      type: 'auth-error',
      payload: 'Authentication is already in progress.'
    });
    return;
  }
  authFlowActive = true;

  try {
    const scope = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';
    const deviceRes = await fetch('https://oauth2.googleapis.com/device/code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: toFormBody({
        client_id: settings.googleClientId,
        scope: scope
      })
    });

    const deviceText = await deviceRes.text();
    let deviceData = {};
    try {
      deviceData = JSON.parse(deviceText);
    } catch (_e) {
      deviceData = {};
    }

    if (!deviceRes.ok) {
      throw new Error('Device auth start failed (' + deviceRes.status + '): ' + deviceText);
    }

    const verificationUrl = deviceData.verification_url_complete || deviceData.verification_url;
    if (!deviceData.device_code || !verificationUrl) {
      throw new Error('Invalid response from Google device endpoint.');
    }

    figma.openExternal(verificationUrl);
    figma.ui.postMessage({
      type: 'auth-pending',
      payload: {
        userCode: deviceData.user_code || '',
        verificationUrl: verificationUrl
      }
    });

    let intervalSec = Number(deviceData.interval || 5);
    const startedAt = Date.now();
    const expiresInSec = Number(deviceData.expires_in || 900);

    while (Date.now() - startedAt < expiresInSec * 1000) {
      await new Promise((resolve) => setTimeout(resolve, intervalSec * 1000));

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: toFormBody({
          client_id: settings.googleClientId,
          client_secret: settings.googleClientSecret,
          device_code: deviceData.device_code,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      });

      const tokenText = await tokenRes.text();
      let tokenData = {};
      try {
        tokenData = JSON.parse(tokenText);
      } catch (_e) {
        tokenData = {};
      }

      if (tokenRes.ok && tokenData.access_token) {
        const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            Authorization: 'Bearer ' + tokenData.access_token
          }
        });
        const userText = await userRes.text();
        let userData = {};
        try {
          userData = JSON.parse(userText);
        } catch (_e) {
          userData = {};
        }

        if (!userRes.ok || !userData.email) {
          throw new Error('Failed to fetch user email (' + userRes.status + '): ' + userText);
        }

        const allowedDomains = parseAllowedDomains(settings.allowedEmailDomains || '');
        if (!isEmailAllowed(userData.email, allowedDomains)) {
          figma.ui.postMessage({
            type: 'auth-error',
            payload: 'Blocked account: ' + userData.email
          });
          authFlowActive = false;
          return;
        }

        figma.ui.postMessage({
          type: 'auth-success',
          payload: {
            accessToken: tokenData.access_token,
            email: userData.email
          }
        });
        authFlowActive = false;
        return;
      }

      if (tokenData.error === 'authorization_pending') {
        continue;
      }
      if (tokenData.error === 'slow_down') {
        intervalSec += 3;
        continue;
      }
      if (tokenData.error === 'access_denied') {
        figma.ui.postMessage({
          type: 'auth-error',
          payload: 'Google authorization denied by user.'
        });
        authFlowActive = false;
        return;
      }
      if (tokenData.error === 'expired_token') {
        figma.ui.postMessage({
          type: 'auth-error',
          payload: 'Authentication timed out. Please try login again.'
        });
        authFlowActive = false;
        return;
      }

      throw new Error('Token polling failed (' + tokenRes.status + '): ' + tokenText);
    }

    figma.ui.postMessage({
      type: 'auth-error',
      payload: 'Authentication timed out. Please try login again.'
    });
    authFlowActive = false;
  } catch (error) {
    figma.ui.postMessage({
      type: 'auth-error',
      payload: error && error.message ? error.message : 'Google authentication failed.'
    });
    authFlowActive = false;
  }
}

async function init() {
  const settings = await loadSettings();
  const filteredNodes = getEligibleNodes();

  figma.ui.postMessage({
    type: 'init',
    payload: {
      settings,
      selectedCount: figma.currentPage.selection.length,
      eligibleCount: filteredNodes.length,
      eligibleNames: filteredNodes.map((n) => n.name)
    }
  });
}

function sanitizeBaseName(raw) {
  return raw
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function getEligibleNodes() {
  return figma.currentPage.selection.filter((node) => {
    const name = node.name.toLowerCase();
    return name.includes('ic_') || name.includes('img_');
  });
}

function classifyNode(node) {
  const lower = node.name.toLowerCase();
  return {
    isIcon: lower.includes('ic_'),
    isImage: lower.includes('img_')
  };
}

async function loadSettings() {
  const saved = await figma.clientStorage.getAsync(SETTINGS_KEY);
  if (!saved) return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

  const merged = Object.assign({}, DEFAULT_SETTINGS, saved || {});
  merged.targets = Object.assign({}, DEFAULT_SETTINGS.targets, (saved && saved.targets) || {});
  merged.android = Object.assign({}, DEFAULT_SETTINGS.android, (saved && saved.android) || {});
  return merged;
}

async function saveSettings(settings) {
  await figma.clientStorage.setAsync(SETTINGS_KEY, settings);
}

function buildUploadPlan(nodes, settings) {
  const plan = [];
  const targets = Object.assign({}, DEFAULT_SETTINGS.targets, settings.targets || {});

  for (const node of nodes) {
    const { isIcon, isImage } = classifyNode(node);
    const base = sanitizeBaseName(node.name);

    // Android: both ic_ and img_ => PNG mdpi~xxxhdpi
    if (targets.android && (isIcon || isImage)) {
      for (const density of ANDROID_SCALES) {
        plan.push({
          nodeId: node.id,
          nodeName: node.name,
          target: 'android',
          format: 'PNG',
          scale: density.scale,
          density: density.key,
          fileName: `${base}.png`,
          folderLink: settings.android[density.key]
        });
      }
    }

    // iOS: img_ => PNG @1x/@2x/@3x, ic_ => SVG
    if (targets.ios && isImage) {
      for (const scale of [1, 2, 3]) {
        plan.push({
          nodeId: node.id,
          nodeName: node.name,
          target: 'ios',
          format: 'PNG',
          scale,
          fileName: `${base}@${scale}x.png`,
          folderLink: settings.iosFolder
        });
      }
    }

    if (targets.ios && isIcon) {
      plan.push({
        nodeId: node.id,
        nodeName: node.name,
        target: 'ios',
        format: 'SVG',
        fileName: `${base}.svg`,
        folderLink: settings.iosFolder
      });
    }

    // Web: img_ => PNG 1x/2x, ic_ => SVG
    if (targets.web && isImage) {
      for (const scale of [1, 2]) {
        plan.push({
          nodeId: node.id,
          nodeName: node.name,
          target: 'web',
          format: 'PNG',
          scale,
          fileName: `${base}@${scale}x.png`,
          folderLink: settings.webFolder
        });
      }
    }

    if (targets.web && isIcon) {
      plan.push({
        nodeId: node.id,
        nodeName: node.name,
        target: 'web',
        format: 'SVG',
        fileName: `${base}.svg`,
        folderLink: settings.webFolder
      });
    }
  }

  return plan;
}

async function exportNode(node, task) {
  if (task.format === 'PNG') {
    return node.exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: task.scale }
    });
  }

  return node.exportAsync({
    format: 'SVG'
  });
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'refresh-selection') {
    const filteredNodes = getEligibleNodes();
    figma.ui.postMessage({
      type: 'selection-updated',
      payload: {
        selectedCount: figma.currentPage.selection.length,
        eligibleCount: filteredNodes.length,
        eligibleNames: filteredNodes.map((n) => n.name)
      }
    });
    return;
  }

  if (msg.type === 'save-settings') {
    await saveSettings(msg.payload);
    figma.ui.postMessage({ type: 'settings-saved' });
    return;
  }

  if (msg.type === 'start-auth') {
    await startDeviceAuth(msg.payload);
    return;
  }

  if (msg.type === 'start-export') {
    const settings = msg.payload;
    await saveSettings(settings);

    const eligibleNodes = getEligibleNodes();
    if (eligibleNodes.length === 0) {
      figma.ui.postMessage({
        type: 'export-error',
        payload: 'No selected layers include ic_ or img_.'
      });
      return;
    }

    const nodeMap = new Map(eligibleNodes.map((n) => [n.id, n]));
    const tasks = buildUploadPlan(eligibleNodes, settings);

    figma.ui.postMessage({
      type: 'export-started',
      payload: { total: tasks.length }
    });

    let prepared = 0;

    for (const task of tasks) {
      const node = nodeMap.get(task.nodeId);
      if (!node) continue;

      try {
        const bytes = await exportNode(node, task);
        prepared += 1;

        figma.ui.postMessage({
          type: 'upload-task',
          payload: Object.assign({}, task, {
            mimeType: task.format === 'SVG' ? 'image/svg+xml' : 'image/png',
            bytes: bytes,
            prepared: prepared
          })
        });
      } catch (error) {
        figma.ui.postMessage({
          type: 'task-failed',
          payload: {
            fileName: task.fileName,
            reason: error && error.message ? error.message : 'export failed'
          }
        });
      }
    }

    figma.ui.postMessage({ type: 'export-queued-done' });
    return;
  }

  if (msg.type === 'close-plugin') {
    figma.closePlugin();
  }
};
