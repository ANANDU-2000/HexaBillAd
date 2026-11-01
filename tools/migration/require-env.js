"use strict";

module.exports = function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be supplied through the environment.`);
  }
  return value;
};
