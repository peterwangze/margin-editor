import assert from 'node:assert/strict'
import {test} from 'node:test'
import {languages} from '@codemirror/language-data'
import {detectLanguage, languageSampleLimit} from '../shared/detect-language.mjs'

test('recognizes HDL headers during editing and distinguishes SystemVerilog syntax', () => {
  const examples = [
    ['module counter(', 'Verilog'],
    ['/* Timing model */\nmodule counter(input clk, output reg q);\nendmodule', 'Verilog'],
    ['`include "defs.vh"\n`define WIDTH 8\nmodule counter(input clk);\nendmodule', 'Verilog'],
    ['module counter(clk, q);\ninput clk;\noutput q;\nendmodule', 'Verilog'],
    ["assign q[3] = clk & 1'b1;", 'Verilog'],
    ['`timescale 1ns/1ps\nmodule counter (input logic clk, output logic q);\nalways_ff @(posedge clk) q <= ~q;\nendmodule', 'SystemVerilog'],
    ['interface link;\n  modport client(input valid);\nendinterface', 'SystemVerilog'],
  ]
  for (const [source, expected] of examples) assert.equal(detectLanguage(source), expected, source)
})

test('recognizes common structured text and source without a filename', () => {
  const examples = [
    ['{"name": "Ada", "items": [1, 2]}', 'JSON'],
    ['{"": true}', 'JSON'],
    ['[1, 2, 3]', 'JSON'],
    ['<!-- site -->\n<!DOCTYPE html><html lang="en"><body></body></html>', 'HTML'],
    ['<section><h1>Hello</h1></section>', 'HTML'],
    ['<?xml version="1.0"?><queue><entry /></queue>', 'XML'],
    ['#!/usr/bin/env -S python3 -u\nprint("hello")', 'Python'],
    ['#!/bin/bash\nprintf "hello"', 'Shell'],
    ['def answer(value: int) -> int:\n    return value * 2', 'Python'],
    ['import values from "./values.js"\nconsole.log(values)', 'JavaScript'],
    ['const width: number = 100;', 'TypeScript'],
    ['select id, name from users where id = 5;', 'SQL'],
    ['# Hardware notes\n\n```verilog\nmodule counter;\nendmodule\n```', 'Markdown'],
  ]
  for (const [source, expected] of examples) {
    assert.ok(languages.some(item => item.name === expected), expected)
    assert.equal(detectLanguage(source), expected, source)
  }
})

test('keeps ordinary prose, ambiguous text and logs in plain text', () => {
  const ordinary = [
    '',
    '先阅读文件，再决定是否保存。',
    'Select items from the menu.',
    'SELECT an option FROM the menu',
    'module guide (diagram)',
    'logic gates can be combined in different ways.',
    '【2026-11-16】 module pulse running',
    '[INFO] Connection established\n[WARN] Retry scheduled',
    '/*\nmodule inside_comment;\nendmodule\n*/',
    '[]',
    '<placeholder>',
    'the first choice language is ambiguous',
    '\n'.repeat(languageSampleLimit) + 'module outside_sample;',
  ]
  for (const source of ordinary) assert.equal(detectLanguage(source), null, source.slice(0, 100))
})
