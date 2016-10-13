#!/bin/bash

# usage:
# $ ./tail-slack.sh "README.md" "https://hooks.slack.com/services/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"

tail -n0 -F "$1" | while read LINE; do
  (echo "$LINE" | grep -e "$3") && curl -X POST --silent --data-urlencode \
    "payload={\"text\": \"$(echo $LINE | sed "s/\"/'/g")\"}" "$2";
done
