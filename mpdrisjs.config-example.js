module.exports = {

  // connection settings
  // defaults to 127.0.0.1:6600
  connection: {
    path: '~/.config/mpd/socket', // if using the socket
    password: 'password' // if requires the password
  },

  music_dir: '~/Music',

  //art: true // enable default cover art serving
  //art: false // disable cover art serving
  art: {
    //fallback: '~/defmpdrisjscover.png', // override the default image
    //fallback: false, // no default image

    //embedded: false, // disable serving of embedded cover art

    frommpd: false, // disable using mpd's `coverart` command to get the art

    dir: false, // disable scanning folder for cover art

    // list of regex and/or strings to match files against
    // default: [ /^(cover|album)?(art)?\.(png|jpg|jpeg|bmp)$/i ]
    //dir: [
    //  'cover.png',
    //  'cover.jpg',
    //  /^art\.(png|jpg|jpeg)$/i,
    //],
  }
}
