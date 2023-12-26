#!/usr/bin/env node

// TODO:
//  more error handling
//  verbose option for logging/better logging
//  prompt to install ffmpeg if not found
//  prompt for overwrite confirmation (and add -y option to automatically confirm it)

const child_process = require('node:child_process');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

const TMPDIR = path.join(os.tmpdir(), 'soundconv');
const OPTIONARGS = new Map([['-a', 'audio'], ['-u', 'url'], ['-o', 'output']]);
const CONTAINERMAP = new Map([['vorbis', 'ogg']]);
const VCODECLIST = ['vp9', 'vp8'];
const ACODECLIST = ['opus', 'ogg'];

const main = async () => {
    if (!fs.existsSync(TMPDIR))
        fs.mkdir(TMPDIR);

    let mode, file, output, audio, url;
    try {
        ({help, mode, file, output, audio, url} = parseArgs(process.argv.slice(2)));
        if (help || mode == null) {
            printUsage();
            return 0;
        } else {
            if (output != null)
                output = path.normalize(output);
            if (file != null)
                file = path.normalize(file);
            validateArgs(file, audio, output);
        }
        if (mode == 'f')
            await fwConv(file, output, audio, url);
        else if (mode == 'b')
            await bwConv(file, output, audio, url);
        return 0;
    } catch (e) {
        console.log(e);
        printUsage();
        return 2;
    }
}

const validateArgs = (file, audio, output) => {
    if (!fs.existsSync(file))
        throw('specified file not found: ' + file);
    if (audio != null && !fs.existsSync(audio))
        throw('specified audio file not found');
    if (output != null && output.lastIndexOf(path.sep) != -1 && !fs.existsSync(output.substring(0, output.lastIndexOf(path.sep) + 1)))
        throw('specified output path does not exist');
}

const parseArgs = (args) => {
    const argObj = {};
    if (args.includes('-h') || args.length == 0)
        return argObj.help = true;

    if (!['f', 'b'].includes(args[0]))
        throw `invalid mode '${args[0]}'`;
    argObj.mode = args[0];

    if (args[1] == undefined)
        throw 'no file provided'
    argObj.file = args[1];

    for (let i = 2; i < args.length; i++) {
        if (OPTIONARGS.has(args[i]))
            if (args[i+1] == undefined || args[i+1].substring(0, 1) === '-')
                throw `missing parameter for ${args[i]}`;
            else
                argObj[OPTIONARGS.get(args[i])] = args[++i];
        else
            throw `unrecognized option ${args[i]}`;
    }
    return argObj;
}

const printUsage = () => {
    console.log('usage: soundconv {f|b} FILE [OPTIONS]\n' + 
                'Modes:\n' +
                '\tf:\tforwards conversion from audio-video to soundpost\n' + 
                '\tb:\tbackwards conversion from soundpost to audio-video\n' + 
                'Options:\n' +
                '\t-a AUDIO:\tspecifies an audio source file to be used in conversion, cannot be paired with -u\n' + 
                '\t-u URL:\t\tspecifies an unencoded catbox url containing audio to be used in conversion, cannot be paired with -a\n' + 
                '\t-o OUTPUT:\tspecifies an output filepath; .webm extension will be appended if not already included; in forwards mode a soundpost string will be inserted before the .webm extension\n' +
                '\t-h, --help:\tprint this help message'
    );
}

const fwConv = async (file, output, audio, url) => {
    const video = extractVideo(file);
    if (url == null) {
        if (audio == null) {
            audio = extractAudio(file);
        }
        url = await uploadAudio(audio);
    }
    url = encodeURL(url);
    output = getFWOutput(url, output);
    fs.renameSync(video, output);
}

const bwConv = async (file, output, audio, url) => {
    const video = extractVideo(file);
    if (audio == null) {
        if (url == null) {
            url = decodeURL(extractURL(file));
        }
        audio = await downloadAudio(url);
    }
    output = getBWOutput(file, output);
    mergeAudio(video, audio, output)
}

// TODO:  add error handling for ffmpeg errors
const extractVideo = (file) => {
    const vcodec = getVideoCodec(file);
    const fileName = path.join(TMPDIR, 'videotemp.webm');
    const videoResult = child_process.spawnSync('ffmpeg', ['-i', file, '-y', '-c:v', VCODECLIST.includes(vcodec)  ? 'copy' : 'libvpx-vp9', '-an', fileName]);
    return fileName;
}

// TODO:  add error handling for ffmpeg errors
const extractAudio = (file) => {
    const acodec = getAudioCodec(file);
    const extension = CONTAINERMAP.has(acodec) ? CONTAINERMAP.get(acodec) : acodec;
    const fileName = path.join(TMPDIR, `audiotemp.${acodec}`);
    const audioResult = child_process.spawnSync('ffmpeg', ['-i', file, '-y', '-c:a', 'copy', '-vn', fileName]);
    return fileName;
}

// TODO: add error handling for ffmpeg errors
const mergeAudio = (video, audio, output) => {
    const vcodec = getVideoCodec(video);
    const acodec = getAudioCodec(audio);
    const mergeResult = child_process.spawnSync('ffmpeg', ['-i', video, '-i', audio, '-y', '-c:v', VCODECLIST.includes(vcodec)  ? 'copy' : 'libvpx-vp9', '-c:a', ACODECLIST.includes(acodec) ? 'copy' : 'libopus', '-map', '0:v:0', '-map', '1:a:0', output]);
}

// TODO: add error handling for ffmpeg errors
const getAudioCodec = (file) => {
    const acodecResult = child_process.spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_name', '-of', 'default=noprint_wrappers=1:nokey=1', file]);
    return acodecResult.stdout.toString().trim();
}

// TODO: add error handling for ffmpeg errors
const getVideoCodec = (file) => {
    const vcodecResult = child_process.spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name', '-of', 'default=noprint_wrappers=1:nokey=1', file]);
    return vcodecResult.stdout.toString().trim();
}

const extractURL = (fileName) => {
    const match = fileName.match(/\[sound=(https?%3A%2F%2F)?([^\]]*catbox\.moe[^\]]*)\]/);
    if (match != null)
        return (match[1] ?? 'https%3A%2F%2F') + match[2];
    else
        throw 'Could not extract url from filename'
}

const encodeURL = (url) => {
    return url.replaceAll(':', '%3A').replaceAll('/', '%2F');
}

const decodeURL = (url) => {
    return url.replaceAll('%3A', ':').replaceAll('%2F', '/');
}

// TODO: add error handling for server errors
const uploadAudio = async (audio) => {
    const data = new FormData();
    data.set('reqtype', 'fileupload');
    data.set('fileToUpload', await fs.openAsBlob(path.resolve(audio)), path.basename(audio));
    const res = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: data });
    return await res.text();
}

// TODO: add error handling for server errors
const downloadAudio = async (url) => {
    return new Promise(async resolve => {
        const audioPath = path.join(TMPDIR, `audiotemp`);
        const fileStream = fs.createWriteStream(audioPath);
        const stream = new WritableStream({
            write(chunk) {
                fileStream.write(chunk);
                fileStream.pipe
            }
        });
        const res = await fetch(url);
        const body = await res.body;
        await body.pipeTo(stream);
        fileStream.close(() => resolve(audioPath));
    });
}

const getFWOutput = (url, output) => {
    const soundString = `[sound=${url}]`;
    let {dir, name, ext} = path.parse(output ?? '');
    if (output != null && (output.lastIndexOf(path.sep) == output.length || output == '.' || output == '..')) {
        dir = output;
        name = '';
        ext = '';
    }
    if (dir == '')
        dir = process.cwd();
    if (ext != '.webm')
        ext += '.webm';
    return path.join(dir, name + soundString + ext);
}

const getBWOutput = (file, output) => {
    const oldName = path.parse(file).name;
    let {dir, name, ext} = path.parse(output ?? '');
    if (output != null && (output.lastIndexOf(path.sep) == output.length - 1 || output == '.' || output == '..')) {
        dir = output;
        name = '';
        ext = '';
    }
    if (dir == '')
        dir = process.cwd();
    if (name == '')
        name = oldName;
    if (ext != '.webm')
        ext += '.webm';
    return path.join(dir, name + ext);
}

main();