# run me on a new mac after installing
#	- Google Drive
#	- Git
#	- Sublime Text

sudo npm install -g bower cordova devtool generator-chrome-extension gulp http-server ionic ios-sim jshint newman node-inspector nodemon npm react-native-cli typescript yo

ln -s ~/Google\ Drive/Tweaks\,\ customizations/mac/.gitexcludes ~/.gitexcludes
ln -s ~/Google\ Drive/Tweaks\,\ customizations/mac/.gitconfig ~/.gitconfig
ln -s ~/Google\ Drive/Tweaks\,\ customizations/mac/.bash_profile ~/.bash_profile
ln -s ~/Google\ Drive/Tweaks\,\ customizations/mac/.inputrc ~/.inputrc

mv ~/Library/Application\ Support/Sublime\ Text\ 3/Packages/User/Default\ \(OSX\).sublime-keymap ~/Library/Application\ Support/Sublime\ Text\ 3/Packages/User/Default\ \(OSX\).sublime-keymap.orig
ln -s ~/Google\ Drive/Tweaks\,\ customizations/sublime/Default\ \(OSX\).sublime-keymap ~/Library/Application\ Support/Sublime\ Text\ 3/Packages/User/Default\ \(OSX\).sublime-keymap

mv ~/Library/Application\ Support/Sublime\ Text\ 3/Packages/User/Preferences.sublime-settings ~/Library/Application\ Support/Sublime\ Text\ 3/Packages/User/Preferences.sublime-settings.orig
ln -s ~/Google\ Drive/Tweaks\,\ customizations/sublime/Preferences.sublime-settings ~/Library/Application\ Support/Sublime\ Text\ 3/Packages/User/Preferences.sublime-settings

mv ~/Library/Application\ Support/Sublime\ Text\ 3/Packages/User/bh_core.sublime-settings ~/Library/Application\ Support/Sublime\ Text\ 3/Packages/User/bh_core.sublime-settings.orig
ln -s ~/Google\ Drive/Tweaks\,\ customizations/sublime/bg_core.sublime-settings ~/Library/Application\ Support/Sublime\ Text\ 3/Packages/User/bh_core.sublime-settings
