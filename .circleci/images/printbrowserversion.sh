#!/bin/bash
if [ "${BROWSER}" == "firefox" ];
then
    echo $(firefox --version)
else
    echo $(google-chrome --version)
fi
