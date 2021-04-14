// Require Modules
const fastify = require('fastify').default

const fs = require('fs')

const ytsr = require('ytsr')

const ytdl = require('ytdl-core')

const mime = require('mime-types')

const prism = require('prism-media')

const needle = require('needle')

// Initiate App
const app = fastify({
    http2: true,
    https: {
        cert: fs.readFileSync('../cert.crt'),
        key: fs.readFileSync('../private.crt')
    }    
})

// Listen (HTTP/2)
app.listen(3000, '192.168.9.206', (err, address) => {

    if (err) {

        console.log(`Err: ${err.message}`)

        return

    }

    console.log(`Listening On: ${address}/`)

})

app.get('/file.mp3', async (req, res) => {

    res.type('audio/mpeg')

    res.send(fs.createReadStream('../music.mp3'))

})

// Handle Streaming
app.get('/stream/*', async (req, res) => {

    // Get URL

    const url = req.query['url'] || null

    if (!url) {

        res.code(401)

        res.send('Invalid URL')

        return

    }

    // Set Status Code
    res.code(200)

    const bitrate = req.query['bitrate'] || 128000

    const rate = req.query['rate'] || 48000

    const format = req.url.split('/stream/')[1].split('?')[0]

    const bass = req.query['bass'] || 0

    let stream

    if (ytdl.validateURL(url)) {

        // Youtube Stream
        stream = ytdl(url, { filter: 'audioonly', quality: 'highestaudio', format: 'mp3' })

    } else {

        res.code(401)

        res.send('Invalid URL')

        return
        
    }

    const transcoder = new prism.FFmpeg({
        args: [
            '-analyzeduration', '0',
            '-loglevel', '0',
            '-f', format,
            '-ar', rate,
            '-ac', '2',
            '-b:a', bitrate,
            '-af', `bass=g=${bass}`
        ],
    })

    stream.pipe(transcoder)

    //fs.createReadStream('../music.webm').pipe(transcoder)
    // Set MIME Type
    res.type(mime.contentType(format))

    // Send Audio File.
    res.send(transcoder)

})

// Handle Searching
app.get('/search', async (req, res) => {

    if (!req.query['query']) {

        // Set MIME Type
        res.type('text/plain')

        // Set Status Code
        res.code(401)

        res.send('No Query Provided.')

        return

    }

    // Set MIME Type
    res.type('text/plain')

    // Set Status Code
    res.code(200)

    const limit = (req.query['limit'] / 1) || 5

    // Get Search Results

    let searchResults = await ytsr(req.query['query'].toString(), {
        //safeSearch: req.query['safeSearch'] === 'on' ? true : false
    })

    let results = []

    let pos = 0

    for (let i = 0; i <= limit; i++) {
        
        let result = searchResults['items'][pos]

        if (pos >= searchResults['items'].length) {

            i = limit + 1

            return

        }

        if (result['type'] === 'video') {

            results.push({
                id: result['id'],
                url: result['url'],
                shortUrl: `https://youtu.be/${result['id']}`,
                description: result['description'],
                title: result['title'],
                duration: result['duration'],
                uploadedAt: result['uploadedAt'],
                bestThumbnail: result['bestThumbnail'].url.slice(0, 44),
                thumbnails: {
                    high: result['thumbnails'][0] ? result['thumbnails'][0]['url'].slice(0, 44) : '',
                    low: result['thumbnails'][1] ? result['thumbnails'][1]['url'].slice(0, 44) : '',
                },
                length: result['duration'],
                seconds: result['duration'],
                views: result['views'],
                live: result['isLive'],
                author: {
                    name: result['author']['name'],
                    channelID: result['author']['channelID'],
                    url: result['author']['url'],
                    bestAvatar: result['author']['bestAvatar']['url'],
                    verified: result['author']['verified'],
                }
            })

            pos++
        
        } else {

            i--

            pos++

        }

    }

    res.send(JSON.stringify(results, null, 2))

})