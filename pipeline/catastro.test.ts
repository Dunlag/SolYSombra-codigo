import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsearParte } from './catastro.ts';

const parte = (plantas: number, extra = '') => `gml:id="ES.SDGC.BU.X_part1">
<bu-ext2d:geometry><gml:Surface srsName="urn:ogc:def:crs:EPSG::25830"><gml:patches><gml:PolygonPatch>
<gml:exterior><gml:LinearRing><gml:posList srsDimension="2" count="5"> 0 0 10 0 10 10 0 10 0 0</gml:posList></gml:LinearRing></gml:exterior>
${extra}</gml:PolygonPatch></gml:patches></gml:Surface></bu-ext2d:geometry>
<bu-ext2d:numberOfFloorsAboveGround>${plantas}</bu-ext2d:numberOfFloorsAboveGround>`;

test('parte de 3 plantas: 9 m y su anillo', () => {
  assert.deepEqual(parsearParte(parte(3)), {
    anillo: [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
    altura: 9,
  });
});

test('parte de 0 plantas se descarta', () => {
  assert.equal(parsearParte(parte(0)), null);
});

test('con patio interior se usa solo el anillo exterior', () => {
  const patio = '<gml:interior><gml:LinearRing><gml:posList>4 4 6 4 6 6 4 6 4 4</gml:posList></gml:LinearRing></gml:interior>';
  assert.equal(parsearParte(parte(2, patio))!.anillo.length, 5);
});

test('la cabecera del fichero no es un edificio', () => {
  assert.equal(parsearParte('<?xml version="1.0"?><gml:FeatureCollection>'), null);
});
