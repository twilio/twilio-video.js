'use strict';

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
}

class HTMLBodyElement extends HTMLElement {
  constructor() {
    super('body');
  }
}

class Document {
  constructor() {
    this.body = new HTMLBodyElement();
  }

  createElement(name) {
    return new HTMLElement(name);
  }

  querySelector() {
    return null;
  }
}

module.exports = Document;
