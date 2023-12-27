# About
SoundConv is a node app which converts video files to and from soundposts for imageboard usage. At the moment, the only supported host is catbox.


# Requirements
[NodeJS](https://nodejs.org/en) - environment for running the app

[FFmpeg](https://ffmpeg.org/download.html) - used for encoding 


# Installation from Source
Download the source code, then simply run:
```
npm i -g
```
From within the directory to install soundconv globally


# Usage
```
usage: soundconv {f|b} FILE [OPTIONS]
Modes:
        f:      forwards conversion from audio-video to soundpost
        b:      backwards conversion from soundpost to audio-video
Options:
        -a AUDIO:       specifies an audio source file to be used in conversion, cannot be paired with -u
        -u URL:         specifies an unencoded catbox url containing audio to be used in conversion, cannot be paired with -a
        -o OUTPUT:      specifies an output filepath; .webm extension will be appended if not already included; in forwards mode a soundpost string will be inserted before the .webm extension
        -h, --help:     print this help message
```

## Detailed Mode Usage

### Forward Mode

When used in forward mode, SoundConv will create a video file with no audio stream from the input file. SoundConv will upload the audio stream from the input file to catbox and encode the resulting url into a soundpost string ([sound=...]) within the file name. 

-a option can be used to specify an audio file to be uploaded to catbox instead of having SoundConv upload the audio stream from the input file.

-u option can be used to specify a catbox url to be used in the soundpost string instead of having SoundConv upload the audio stream from the input file.


### Backward Mode

When used in backward mode, SoundConv will create a video file with an audio stream. SoundConv will parse a catbox url from the input file and download the audio stream from the url.

-a option can be used to specify an audio file to be uploaded to catbox instead of having SoundConv upload the audio stream from the input file.

-u option can be used to specify a catbox url to be used in the soundpost string instead of having SoundConv upload the audio stream from the input file.


## Output File Naming
TODO


# TODO

Planned improvements:

* Output: output file naming sucks right now and should be redone
* Error handling: errors need to be handled, and there is too much undefined behaviour in terms of errors/unexpected input
* Logging: goes hand in hand with error handling; a verbosity option should also be added
* Handle FFmpeg not found: the app will not work without ffmpeg; we should at the very least warn the user if ffmpeg cannot be found, if not install it for them/provide static binaries
* Confirm overwrite: SoundConv is not intended to convert files in place; if output file would overwrite any file (namely the input file) this should be confirmed with user first; -y option should also be added to auto-confirm
