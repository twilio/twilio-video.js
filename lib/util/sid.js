const SID_CHARS = '1234567890abcdef';
const SID_CHAR_LENGTH = 32;
// copied from: https://code.hq.twilio.com/flex/monkey/blob/0fdce2b6c52d6be0b17a5cdb92f0c54f119b8ea8/src/client/lib/sid.ts#L39

/**
 * Generates a random sid using given prefix.
 * @param {string} prefix
 * @returns string
 */
function createSID(prefix) {
  let result = '';
  for (let i = 0; i < SID_CHAR_LENGTH; i++) {
    result += SID_CHARS.charAt(Math.floor(Math.random() * SID_CHARS.length));
  }
  return `${prefix}${result}`;
}

exports.sessionSID = createSID('SS');
exports.createSID = createSID;

