module.exports = {
  packagerConfig: {
    name: 'SI PENANGKAR HORTI',
    executableName: 'SI-PENANGKAR-HORTI'
  },
  makers: [
    { name: '@electron-forge/maker-squirrel' },
    { name: '@electron-forge/maker-zip', platforms: ['win32'] }
  ]
};
