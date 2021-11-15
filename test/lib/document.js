'use strict';
const { EventEmitter } = require('events');

class HTMLElement {
  constructor(tagName) {
    this.children = [];
    this.parentNode = null;
    this.tagName = tagName;
  }

  appendChild(element) {
    element.parentNode = this;
    this.children.push(element);
    return this;
  }

  removeChild(element) {
    const index = this.children.indexOf(element);
    if (index > -1) {
      this.children.splice(index, 1);
    }
    return this;
  }

  remove() {

  }

  play() {
    return Promise.resolve();
  }

  pause() {
    return Promise.resolve();
  }

  addEventListener() {}
  removeEventListener() {}
}

class HTMLBodyElement extends HTMLElement {
  constructor() {
    super('body');
  }
}

class Document extends EventEmitter {
  constructor() {
    super();
    this.visibilityState = 'visible';
    this.body = new HTMLBodyElement();
  }

  createElement(name) {
    return new HTMLElement(name);
  }

  querySelector() {
    return null;
  }

  dispatchEvent(event, ...args) {
    this.emit(event, ...args);
  }

  addEventListener(...args) {
    this.addListener(...args);
  }

  removeEventListener(...args) {
    this.removeListener(...args);
  }
}

module.exports = Document;
