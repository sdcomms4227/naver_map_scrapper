const {By, until} = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

// Chrome 옵션 설정
function getChromeOptions() {
    const options = new chrome.Options();
    
    // Add necessary arguments
    options.addArguments(
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--disable-notifications',
        '--disable-popup-blocking',
        '--disable-infobars',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--ignore-certificate-errors',
        '--ignore-ssl-errors',
        '--enable-unsafe-swiftshader',
        '--window-size=1920,1080'
    );
    
    // Add experimental options
    options.addArguments('--enable-features=NetworkService,NetworkServiceInProcess');
    
    // Set performance logging preferences
    options.setLoggingPrefs({
        'browser': 'ALL',
        'driver': 'ALL',
        'performance': 'ALL'
    });
    
    // Set additional capabilities
    options.setAcceptInsecureCerts(true);
    options.setPageLoadStrategy('eager');
    
    // 포어그라운드/백그라운드 모드에 따라 headless 옵션 설정
    if (process.env.CHROME_MODE === 'background') {
        options.addArguments('--headless');
    }
    
    return options;
}

const waitForElement = async (driver, selector, timeout = 10000) => {
    try {
        const element = await driver.wait(until.elementLocated(By.css(selector)), timeout);
        return element;
    } catch (error) {
        console.error(`[오류] 요소를 찾을 수 없습니다: ${selector}`);
        try {
            await driver.quit();
        } catch (quitError) {
            console.error('브라우저 종료 중 오류:', quitError.message);
        }
        console.error('스크립트를 중지합니다.');
        process.exit(1);
    }
};

module.exports = {
    waitForElement,
    getChromeOptions
}; 