#!/bin/bash

cd extension
mkdir modules
cp ../extract.jsm modules
mkdir chrome/content/locale
cp ../*.properties chrome/content/locale
zip -r event-extract.xpi chrome modules chrome.manifest install.rdf

rm -r modules
rm -r chrome/content/locale
