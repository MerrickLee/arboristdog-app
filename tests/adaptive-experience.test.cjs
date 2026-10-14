/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function loadTypeScript(relativePath) {
  const filename = path.resolve(__dirname, '..', relativePath);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(code, filename);
  return loaded.exports;
}

const { getAdaptiveLayout } = loadTypeScript('utils/adaptiveLayout.ts');
const { useDiagnosisStore } = loadTypeScript('stores/diagnosisStore.ts');

test('compact phones keep one pane; expanded windows leave usable space for both panes', () => {
  for (const width of [320, 375, 390, 430, 600, 719]) {
    const layout = getAdaptiveLayout(width);
    assert.equal(layout.expanded, false);
    assert.equal(layout.mainWidth, width);
  }
  for (const width of [720, 736, 800, 1024, 1600]) {
    const layout = getAdaptiveLayout(width);
    assert.equal(layout.expanded, true);
    assert.ok(layout.supportWidth >= 300);
    assert.ok(layout.mainWidth >= 400);
    assert.equal(layout.experienceWidth, width);
    assert.equal(layout.supportWidth + layout.mainWidth, layout.experienceWidth);
  }
});

test('large text returns a narrow expanded window to a readable single pane', () => {
  assert.equal(getAdaptiveLayout(736, 1.4).expanded, false);
  assert.equal(getAdaptiveLayout(1024, 1.4).expanded, true);
  assert.equal(getAdaptiveLayout(1200, 2).expanded, false);
});

const saved = {
  id: 'saved-scan', condition_name: 'Saved condition', confidence: 80, severity: 'low',
  image_url: 'https://example.com/saved-photo.jpg', created_at: '2026-10-05T10:00:00Z',
  symptoms: ['Wilting'], description: 'Saved notes',
  location_json: { address: 'Saved property', propertyType: 'residential' },
  diagnosis_json: { condition_name: 'Saved condition', confidence: 80, severity: 'low', explanation: 'Saved assessment', actions: [] },
};

test('selecting a history preview leaves the current scan untouched', () => {
  const store = useDiagnosisStore;
  store.getState().resetSession();
  store.getState().setCapturedImage('file:///current-photo.jpg');
  store.getState().setContext(['Discoloration'], 'Current notes');
  store.getState().setHistoryPreview(saved);
  assert.equal(store.getState().capturedImage, 'file:///current-photo.jpg');
  assert.equal(store.getState().description, 'Current notes');
  assert.equal(store.getState().historyPreview.id, saved.id);
});

test('opening a saved scan restores its own image and context, including missing fields', () => {
  const store = useDiagnosisStore;
  store.getState().restoreDiagnosis(saved);
  assert.equal(store.getState().capturedImage, null);
  assert.equal(store.getState().remoteImageUrl, saved.image_url);
  assert.equal(store.getState().description, 'Saved notes');
  assert.deepEqual(store.getState().selectedTags, ['Wilting']);
  assert.equal(store.getState().location.address, 'Saved property');
  store.getState().restoreDiagnosis({ ...saved, image_url: null, symptoms: null, description: null, location_json: null });
  assert.equal(store.getState().remoteImageUrl, null);
  assert.equal(store.getState().description, '');
  assert.deepEqual(store.getState().selectedTags, []);
  assert.equal(store.getState().location, null);
});
