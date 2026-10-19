/* electron-builder afterSign 钩子：
 * 未签名构建（identity: null）时 electron-builder 只做 linker-signed adhoc 签名，
 * 二进制会被系统直接 Killed: 9。这里补一次完整 adhoc 深签，保证本机/同机分享可运行。
 */
const { execFileSync } = require('child_process');

exports.default = async function afterSign(context) {
  const appPath = context.appOutDir + '/' + context.packager.appInfo.productFilename + '.app';
  try {
    execFileSync('codesign', ['-s', '-', '--force', '--deep', appPath], { stdio: 'inherit' });
    console.log(`[after-sign] adhoc 深签完成：${appPath}`);
  } catch (e) {
    console.warn('[after-sign] 深签失败（不影响产物，但系统可能拦截运行）：', e.message);
  }
};
