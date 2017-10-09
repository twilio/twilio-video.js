'use strict';

const assert = require('assert');
const sinon = require('sinon');

const DataTrackSender = require('../../../../../lib/data/sender');
const LocalDataTrack = require('../../../../../lib/media/track/localdatatrack');
const { combinationContext, randomName } = require('../../../../lib/util');

describe('LocalDataTrack', () => {
  let dataTrackSender;
  let dataTrack;

  beforeEach(() => {
    dataTrack = new LocalDataTrack({
      DataTrackSender: function() {
        dataTrackSender = new DataTrackSender(null, null, true);
        return dataTrackSender;
      }
    });
  });

  describe('constructor', () => {
    it('returns an instance of LocalDataTrack', () => {
      assert(dataTrack instanceof LocalDataTrack);
    });

    it('constructs a new DataTrackSender', () => {
      assert(dataTrackSender instanceof DataTrackSender);
    });

    it('sets .id to the DataTrackSender\'s ID', () => {
      assert.equal(dataTrack.id, dataTrackSender.id);
    });

    it('sets .kind to "data"', () => {
      assert.equal(dataTrack.kind, 'data');
    });

    [true, false].forEach(isNamePresentInOptions => {
      let sender;
      let track;

      context(`when .name is ${isNamePresentInOptions ? '' : 'not '}present in LocalTrackOptions`, () => {
        before(() => {
          const nameOption = isNamePresentInOptions ? { name: 'foo' } : {};
          track = new LocalDataTrack(Object.assign(nameOption, {
            DataTrackSender: function() {
              sender = new DataTrackSender(null, null, true);
              return sender;
            }
          }));
        });

        it(`sets .name to ${isNamePresentInOptions ? 'LocalTrackOptions\' .name' : 'DataTrackSender\'s ID'}`, () => {
          assert.equal(track.name, isNamePresentInOptions ? 'foo' : sender.id);
        });
      });
    });

    combinationContext([
      [
        [
          { option: 'maxPacketLifeTime',
            defaultValue: null,
            randomValue: () => Math.floor(Math.random() * 1000) },
          { option: 'maxRetransmits',
            defaultValue: null,
            randomValue: () => Math.floor(Math.random() * 1000) },
          { option: 'ordered',
            defaultValue: true,
            randomValue: () => Math.random() > 0.5 }
        ],
        x => `when .${x[0]} is`
      ],
      [
        [true, false],
        x => `${x ? 'present' : 'not present'} in LocalDataTrackOptions`
      ]
    ], ([{ option, defaultValue, randomValue }, isPresent]) => {
      let sender;
      let track;
      let value;

      beforeEach(() => {
        value = randomValue();
        const options = {};
        if (isPresent) {
          options[option] = value;
        }
        track = new LocalDataTrack(options);
        sender = track._dataTrackSender;
      });

      if (isPresent) {
        it(`should set .${option} to the specified value`, () => {
          assert.equal(sender[option], value);
          assert.equal(track[option], value);
        });
      } else {
        it(`should set .${option} to the default value`, () => {
          assert.equal(sender[option], defaultValue);
          assert.equal(track[option], defaultValue);
        });
      }
    });

  });

  describe('#send', () => {
    let data;

    beforeEach(() => {
      data = randomName();
      dataTrackSender.send = sinon.spy(dataTrackSender.send.bind(dataTrackSender));
      dataTrack.send(data);
    });

    it('calls #send on the underlying DataTrackSender', () => {
      sinon.assert.calledOnce(dataTrackSender.send);
      sinon.assert.calledWith(dataTrackSender.send, data);
    });
  });
});
