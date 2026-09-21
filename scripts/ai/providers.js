// One function, callModel, over the two wire protocols that cover every
// provider in config.js: Anthropic's Messages API, and the OpenAI-compatible
// chat-completions shape (OpenAI, Gemini's compatibility endpoint,
// OpenRouter, Ollama, LM Studio, and most others).
//
// Messages use a provider-neutral shape:
//   { role: 'user' | 'assistant', content: [ { type: 'text', text },
//                                            { type: 'image', mediaType, data } ] }
// where image data is base64. No SDKs: plain http(s), so the helper has no
// dependencies beyond Playwright.

var http = require('http');
var https = require('https');
var configModule = require('./config.js');

var ANTHROPIC_VERSION = '2023-06-01';
var ANTHROPIC_MAX_TOKENS = 16000;
var REQUEST_TIMEOUT_MS = 15 * 60 * 1000;

function toAnthropic(system, messages, model) {
  return {
    model: model,
    max_tokens: ANTHROPIC_MAX_TOKENS,
    system: system,
    messages: messages.map(function (m) {
      return {
        role: m.role,
        content: m.content.map(function (part) {
          if (part.type === 'image') {
            return { type: 'image', source: { type: 'base64', media_type: part.mediaType, data: part.data } };
          }
          return { type: 'text', text: part.text };
        }),
      };
    }),
  };
}

function toOpenAI(system, messages, model) {
  return {
    model: model,
    messages: [{ role: 'system', content: system }].concat(messages.map(function (m) {
      if (m.role === 'assistant') {
        return { role: 'assistant', content: m.content.map(function (p) { return p.text || ''; }).join('\n') };
      }
      return {
        role: m.role,
        content: m.content.map(function (part) {
          if (part.type === 'image') {
            return { type: 'image_url', image_url: { url: 'data:' + part.mediaType + ';base64,' + part.data } };
          }
          return { type: 'text', text: part.text };
        }),
      };
    })),
  };
}

// Builds { url, headers, body } for a request — pure, so it's testable
// without a network.
function buildRequest(api, apiKey, system, messages) {
  var provider = configModule.findProvider(api.provider);
  var base = api.baseUrl.replace(/\/+$/, '');
  if (provider.format === 'anthropic') {
    return {
      url: base + '/v1/messages',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION },
      body: toAnthropic(system, messages, api.model),
    };
  }
  var headers = { 'content-type': 'application/json' };
  if (apiKey) headers.authorization = 'Bearer ' + apiKey;
  return { url: base + '/chat/completions', headers: headers, body: toOpenAI(system, messages, api.model) };
}

// Pulls the reply text out of either protocol's response, or throws with the
// provider's own error message.
function parseResponse(format, status, json) {
  if (status >= 400 || (json && json.error)) {
    var err = json && json.error;
    var message = (err && (err.message || (typeof err === 'string' ? err : JSON.stringify(err)))) || 'HTTP ' + status;
    throw new Error('HTTP ' + status + ': ' + message);
  }
  if (format === 'anthropic') {
    var text = (json.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('');
    if (json.stop_reason === 'max_tokens') throw new Error('the model hit its output limit before finishing');
    return text;
  }
  var choice = json.choices && json.choices[0];
  if (!choice) throw new Error('no choices in response');
  if (choice.finish_reason === 'length') throw new Error('the model hit its output limit before finishing');
  var content = choice.message && choice.message.content;
  return Array.isArray(content) ? content.map(function (p) { return p.text || ''; }).join('') : content || '';
}

function requestJson(method, url, headers, body, signal, timeoutMs) {
  return new Promise(function (resolve, reject) {
    var parsed = new URL(url);
    var client = parsed.protocol === 'http:' ? http : https;
    var payload = body === undefined ? '' : JSON.stringify(body);
    var req = client.request(parsed, {
      method: method,
      headers: Object.assign(payload ? { 'content-length': Buffer.byteLength(payload) } : {}, headers),
      timeout: timeoutMs || REQUEST_TIMEOUT_MS,
    }, function (res) {
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        var text = Buffer.concat(chunks).toString('utf8');
        var json;
        try {
          json = JSON.parse(text);
        } catch (e) {
          return reject(new Error('HTTP ' + res.statusCode + ': not JSON: ' + text.slice(0, 300)));
        }
        resolve({ status: res.statusCode, json: json });
      });
    });
    req.on('timeout', function () { req.destroy(new Error('request timed out')); });
    req.on('error', reject);
    if (signal) {
      if (signal.aborted) return req.destroy(new Error('stopped'));
      signal.addEventListener('abort', function () { req.destroy(new Error('stopped')); }, { once: true });
    }
    req.end(payload || undefined);
  });
}

function postJson(url, headers, body, signal) {
  return requestJson('POST', url, headers, body, signal);
}

// Providers sometimes quote the key back in an error ("Incorrect API key
// provided: sk-…"); those messages reach the app and the drain log, so the
// key is masked to its last four characters first.
function redactKey(err, apiKey) {
  if (apiKey && apiKey.length > 4 && err && typeof err.message === 'string') {
    err.message = err.message.split(apiKey).join('…' + apiKey.slice(-4));
  }
  return err;
}

// The model ids a provider offers to this key, for the Connect panel's
// picker. Both protocols expose a list endpoint with { data: [{ id }] }.
async function listModels(api, options) {
  try {
    return await listModelsUnsafe(api, options);
  } catch (e) {
    throw redactKey(e, configModule.resolveApiKey(api, (options || {}).env));
  }
}

async function listModelsUnsafe(api, options) {
  options = options || {};
  var provider = configModule.findProvider(api.provider);
  var apiKey = configModule.resolveApiKey(api, options.env);
  var base = api.baseUrl.replace(/\/+$/, '');
  var url = provider.format === 'anthropic' ? base + '/v1/models?limit=100' : base + '/models';
  var headers = provider.format === 'anthropic'
    ? { 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION }
    : apiKey ? { authorization: 'Bearer ' + apiKey } : {};
  var refused = configModule.insecureKeyTransport(url, apiKey);
  if (refused) throw new Error(refused);
  var response;
  try {
    response = await requestJson('GET', url, headers, undefined, null, options.timeoutMs || 15000);
  } catch (e) {
    throw new Error('could not reach ' + base + ': ' + e.message);
  }
  if (response.status >= 400) {
    var err = response.json && response.json.error;
    throw new Error(response.status === 401 || response.status === 403
      ? 'That key was not accepted.'
      : 'HTTP ' + response.status + ': ' + ((err && err.message) || 'could not list models'));
  }
  return ((response.json && response.json.data) || []).map(function (m) { return m.id; }).filter(Boolean);
}

async function callModel(api, system, messages, options) {
  try {
    return await callModelUnsafe(api, system, messages, options);
  } catch (e) {
    throw redactKey(e, configModule.resolveApiKey(api, (options || {}).env));
  }
}

async function callModelUnsafe(api, system, messages, options) {
  options = options || {};
  var apiKey = configModule.resolveApiKey(api, options.env);
  var request = buildRequest(api, apiKey, system, messages);
  var refused = configModule.insecureKeyTransport(request.url, apiKey);
  if (refused) throw new Error(refused);
  var format = configModule.findProvider(api.provider).format;
  var response;
  try {
    response = await postJson(request.url, request.headers, request.body, options.signal);
  } catch (e) {
    throw new Error('could not reach ' + request.url + ': ' + e.message);
  }
  return parseResponse(format, response.status, response.json);
}

module.exports = {
  buildRequest: buildRequest,
  parseResponse: parseResponse,
  redactKey: redactKey,
  callModel: callModel,
  listModels: listModels,
};
