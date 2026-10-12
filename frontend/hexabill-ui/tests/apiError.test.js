import test from 'node:test'
import assert from 'node:assert/strict'
import { readApiErrorReason, saveOutcomeIsUncertain } from '../src/utils/apiError.js'

const err = (status, data) => ({ response: { status, data } })

test('reads app message, errors list, validation object and title', () => {
  assert.equal(readApiErrorReason(err(409, { message: 'Phone already exists' })), 'Phone already exists')
  assert.equal(readApiErrorReason(err(400, { errors: ['a', 'b'] })), 'a, b')
  assert.equal(readApiErrorReason(err(400, { errors: { Email: ['The Email field is not a valid e-mail address.'] } })), 'The Email field is not a valid e-mail address.')
  assert.equal(readApiErrorReason(err(400, { title: 'One or more validation errors occurred.' })), 'One or more validation errors occurred.')
  assert.equal(readApiErrorReason(err(502, '<html>bad gateway</html>'), 'fallback'), 'fallback')
})

test('server errors and lost responses may have saved; client errors did not', () => {
  assert.equal(saveOutcomeIsUncertain(err(500, {})), true)
  assert.equal(saveOutcomeIsUncertain(err(504, '')), true)
  assert.equal(saveOutcomeIsUncertain({ message: 'Network Error' }), true)
  assert.equal(saveOutcomeIsUncertain(err(400, {})), false)
  assert.equal(saveOutcomeIsUncertain(err(409, {})), false)
})
