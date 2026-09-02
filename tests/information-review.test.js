import test from 'node:test';
import assert from 'node:assert/strict';
import { detectInformationWarnings, mergeInformationWarnings } from '../server/services/information-review.js';

const reproduction = `Hãy đánh giá hiệu suất làm việc của nhân viên Nguyễn Minh An,
mã nhân viên NV-1024, email an.nguyen@novatech-internal.example,
đang tham gia dự án Phoenix của Công ty NovaTech.`;

test('detects and masks personal, organization and project references', () => {
  assert.deepEqual(detectInformationWarnings(reproduction), [
    { type: 'personal', title: 'Personal identifiers', description: 'Name, employee ID and email', detectedValues: ['Nguyễn M*** A***', '***1024', 'a***@novatech-internal.example'] },
    { type: 'organization', title: 'Organization references', description: 'Company reference', detectedValues: ['NovaT***'] },
    { type: 'project', title: 'Project references', description: 'Private project identifier', detectedValues: ['Project Phoe***'] }
  ]);
});

test('does not warn for generic references', () => {
  assert.deepEqual(detectInformationWarnings('Hãy đánh giá hiệu suất của một nhân viên trong công ty.'), []);
});

test('detects a project without unrelated warnings', () => {
  assert.deepEqual(detectInformationWarnings('Tạo test plan cho dự án Phoenix.'), [
    { type: 'project', title: 'Project references', description: 'Private project identifier', detectedValues: ['Project Phoe***'] }
  ]);
});

test('merges duplicate values case-insensitively', () => {
  const rules = detectInformationWarnings('Mã nhân viên NV-1024, email an.nguyen@example.com.');
  const merged = mergeInformationWarnings([{ type: 'personal', title: 'Personal identifiers', detectedValues: ['***1024'] }], rules);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].detectedValues, ['***1024', 'a***@example.com']);
});
