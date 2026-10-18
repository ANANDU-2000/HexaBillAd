import test from 'node:test'
import assert from 'node:assert/strict'
import {
  fileProblem, currentVersion, latestPending, describeSearch, daysToExpiry, expiryLabel, sizeLabel, buildUploadForm, MAX_DOCUMENT_BYTES, MAX_IMAGE_BYTES,
} from '../src/features/documents/documentsView.js'

const file = (name, size) => ({ name, size })

test('files are checked before anything is sent', () => {
  assert.equal(fileProblem(null), 'Choose a file.')
  assert.match(fileProblem(file('run.exe', 10)), /Upload a PDF/)
  assert.match(fileProblem(file('notes', 10)), /Upload a PDF/)
  assert.match(fileProblem(file('a.pdf', 0)), /empty/)
  assert.match(fileProblem(file('big.png', MAX_IMAGE_BYTES + 1)), /Images can be at most 10 MB/)
  assert.match(fileProblem(file('big.pdf', MAX_DOCUMENT_BYTES + 1)), /Documents can be at most 20 MB/)
  assert.equal(fileProblem(file('Licence.PDF', 1000)), null)
  assert.equal(fileProblem(file('photo.JPG', MAX_IMAGE_BYTES)), null)
})

test('the version people rely on is the approved current one', () => {
  const doc = { currentVersionId: 'b', versions: [{ id: 'c', status: 'NeedsReview' }, { id: 'b', status: 'Approved' }, { id: 'a', status: 'Superseded' }] }
  assert.equal(currentVersion(doc).id, 'b')
  assert.equal(latestPending(doc).id, 'c')
  assert.equal(currentVersion({ versions: [] }), null)
  assert.equal(latestPending({ versions: [{ id: 'x', status: 'Approved' }] }), null)
})

test('search state is explained in plain words', () => {
  assert.equal(describeSearch(null).label, 'Waiting for approval')
  assert.equal(describeSearch({ searchStatus: 'Searchable' }).tone, 'success')
  const scan = describeSearch({ searchStatus: 'NotSearchable', searchNote: 'This PDF has no readable text (it may be a scan).' })
  assert.equal(scan.tone, 'warning')
  assert.match(scan.detail, /may be a scan/)
  assert.equal(describeSearch({ searchStatus: 'None' }).label, 'Not indexed yet')
})

test('expiry is shown as days, with a warning window and a past state', () => {
  const now = new Date('2026-10-18T12:00:00Z')
  assert.equal(expiryLabel({}, now), null)
  assert.equal(expiryLabel({ expiresOn: 'garbage' }, now), null)
  assert.equal(daysToExpiry({ expiresOn: '2026-10-28T12:00:00Z' }, now), 10)
  assert.equal(expiryLabel({ expiresOn: '2026-10-28T12:00:00Z' }, now).tone, 'warning')
  assert.equal(expiryLabel({ expiresOn: '2027-03-01T00:00:00Z' }, now).tone, 'neutral')
  const past = expiryLabel({ expiresOn: '2026-10-10T12:00:00Z' }, now)
  assert.equal(past.tone, 'error')
  assert.match(past.text, /Expired 8 days ago.*no longer searchable/)
})

test('sizes are short and readable', () => {
  assert.equal(sizeLabel(500), '500 B')
  assert.equal(sizeLabel(2048), '2 KB')
  assert.equal(sizeLabel(5 * 1024 * 1024), '5.0 MB')
  assert.equal(sizeLabel(undefined), '0 B')
})

test('a new document sends its details, a new version sends only the file and the document id', () => {
  const f = new File(['x'], 'a.txt')
  const created = buildUploadForm({ file: f, title: '  Fire policy ', docType: 'Policy', visibility: 'AllStaff', expiresOn: '2027-01-31' })
  assert.equal(created.get('Title'), 'Fire policy')
  assert.equal(created.get('DocType'), 'Policy')
  assert.equal(created.get('Visibility'), 'AllStaff')
  assert.match(created.get('ExpiresOn'), /^2027-01-31T00:00:00/)
  assert.equal(created.get('DocumentId'), null)
  const version = buildUploadForm({ file: f, documentId: 'abc', title: 'ignored' })
  assert.equal(version.get('DocumentId'), 'abc')
  assert.equal(version.get('Title'), null)
  assert.equal(version.get('ExpiresOn'), null)
})
