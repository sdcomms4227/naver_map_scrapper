require('dotenv').config();
const {Builder, By, Key, until} = require('selenium-webdriver');
const { getChromeOptions } = require('./utils');

// Define constants
let SEARCH_KEYWORD = "";
let FILTER_KEYWORDS = [];

// URL 파라미터에서 검색어와 필터 키워드를 가져오는 함수
function getParamsFromUrl() {
    // 명령줄 인자에서 URL 파라미터를 직접 가져오기
    const args = process.argv.slice(2);
    console.log('명령줄 인자:', args);
    
    let searchKeyword = "";
    let filterKeywords = [];
    
    // 각 인자를 파싱
    for (const arg of args) {
        if (arg.startsWith('keyword=')) {
            searchKeyword = decodeURIComponent(arg.substring(8));
        } else if (arg.startsWith('filters=')) {
            filterKeywords = decodeURIComponent(arg.substring(8)).split(',').map(k => k.trim());
        }
    }
    
    console.log('파싱된 파라미터:', { searchKeyword, filterKeywords });
    
    if (searchKeyword) {
        SEARCH_KEYWORD = searchKeyword;
    }
    
    if (filterKeywords.length > 0) {
        FILTER_KEYWORDS = filterKeywords;
    }
    
    return {
        searchKeyword: SEARCH_KEYWORD,
        filterKeywords: FILTER_KEYWORDS
    };
}

const run = async () => {
    // URL 파라미터에서 검색어와 필터 키워드 가져오기
    const { searchKeyword, filterKeywords } = getParamsFromUrl();
    console.log(`검색어: ${searchKeyword}`);
    console.log(`필터 키워드: ${filterKeywords.join(', ')}`);
    
    const driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(getChromeOptions())
        .build();

    try {
        // Set window size
        await driver.manage().window().setRect({ width: 1920, height: 1080 });
        
        console.log('Starting map search process...');
        
        // 특정 URL 생성
        await driver.get('https://map.naver.com/');
        console.log('Loaded Naver Maps');
        
        let userAgent = await driver.executeScript("return navigator.userAgent;")
        console.log('[UserAgent]', userAgent);

        // 검색 입력 필드 대기
        await driver.wait(until.elementLocated(By.css('input[class="input_search"]')), 10000);
        console.log('Search input field found');

        // 검색어 입력
        const searchInput = await driver.findElement(By.css('input[class="input_search"]'));
        await searchInput.sendKeys(searchKeyword, Key.RETURN);
        console.log('Search keyword entered:', searchKeyword);
        await driver.sleep(2000);

        // searchIframe으로 전환
        await driver.switchTo().defaultContent();
        await driver.wait(until.elementLocated(By.css('iframe#searchIframe')), 10000);
        const searchIframe = await driver.findElement(By.css('iframe#searchIframe'));
        await driver.switchTo().frame(searchIframe);
        console.log('Switched to searchIframe');

        // 검색 결과 대기
        await driver.wait(until.elementLocated(By.css('div#_pcmap_list_scroll_container')), 10000);
        console.log('Search results container found');

        // 검색 결과 수집
        const results = [];
        const placeElements = await driver.findElements(By.css('div#_pcmap_list_scroll_container > ul > li'));
        console.log(`Found ${placeElements.length} places`);

        for (let i = 0; i < placeElements.length; i++) {
            try {
                // 장소명 가져오기 (첫 번째 span.YwYLL)
                const nameElement = await placeElements[i].findElement(By.css('div.place_bluelink span.YwYLL'));
                const name = await nameElement.getText();
                console.log(`Processing place: ${name}`);

                // 필터 키워드 가져오기 (마지막 span.YzBgS)
                const filterElement = await placeElements[i].findElement(By.css('div.place_bluelink span.YzBgS'));
                const filterText = await filterElement.getText();
                console.log(`Filter text: ${filterText}`);

                // 장소 링크 클릭
                const placeLink = await placeElements[i].findElement(By.css('div.place_bluelink'));
                await placeLink.click();
                console.log('Clicked place link');
                await driver.sleep(2000);

                // entryIframe으로 전환
                await driver.switchTo().defaultContent();
                await driver.wait(until.elementLocated(By.css('iframe#entryIframe')), 10000);
                const entryIframe = await driver.findElement(By.css('iframe#entryIframe'));
                await driver.switchTo().frame(entryIframe);
                console.log('Switched to entryIframe');

                // 주소 가져오기
                const addressElement = await driver.findElement(By.css('span.LDgIH'));
                const address = await addressElement.getText();
                console.log(`Address: ${address}`);

                // 전화번호 가져오기
                let tel = '';
                try {
                    const phoneElement = await driver.findElement(By.css('span.xlx7Q'));
                    tel = await phoneElement.getText();
                    console.log(`Phone: ${tel}`);
                } catch (phoneError) {
                    console.log('Phone number not found');
                }

                // 예약 가능 여부 확인
                let isBookable = false;
                let bookingItemsCount = 0;
                try {
                    const bookingContainer = await driver.findElement(By.css('div.UoIF_'));
                    const bookingElement = await bookingContainer.findElement(By.css('a.D_Xqt span'));
                    const bookingText = await bookingElement.getText();
                    isBookable = bookingText === '예약' || bookingText === '예매';
                    console.log(`Booking available: ${isBookable} (${bookingText})`);

                    if (isBookable) {
                        // 예약 버튼 클릭
                        await bookingElement.click();
                        console.log('Clicked booking button');
                        await driver.sleep(2000);

                        // 예약 아이템 개수 확인
                        const bookingItems = await driver.findElements(By.css('div.place_section_content ul > li'));
                        bookingItemsCount = bookingItems.length;
                        console.log(`Found ${bookingItemsCount} booking items`);

                        // 뒤로 가기
                        await driver.navigate().back();
                        console.log('Navigated back');
                        await driver.sleep(2000);

                        // entryIframe으로 다시 전환
                        await driver.switchTo().defaultContent();
                        await driver.wait(until.elementLocated(By.css('iframe#entryIframe')), 10000);
                        const entryIframe = await driver.findElement(By.css('iframe#entryIframe'));
                        await driver.switchTo().frame(entryIframe);
                        console.log('Switched back to entryIframe');
                    }
                } catch (bookingError) {
                    console.log('Booking not available');
                }

                // searchIframe으로 돌아가기
                await driver.switchTo().defaultContent();
                await driver.wait(until.elementLocated(By.css('iframe#searchIframe')), 10000);
                const searchIframe = await driver.findElement(By.css('iframe#searchIframe'));
                await driver.switchTo().frame(searchIframe);
                console.log('Switched back to searchIframe');

                // 필터 키워드 체크
                let matchesFilter = true;
                if (filterKeywords.length > 0) {
                    matchesFilter = filterKeywords.some(keyword => 
                        filterText.toLowerCase().includes(keyword.toLowerCase())
                    );
                }

                if (matchesFilter) {
                    results.push({
                        id: i + 1,
                        name,
                        filter: filterText,
                        address,
                        tel,
                        isBookable,
                        bookingItemsCount
                    });
                }
            } catch (error) {
                console.error('Error processing place:', error);
                // 에러 발생 시 searchIframe으로 돌아가기
                try {
                    await driver.switchTo().defaultContent();
                    await driver.wait(until.elementLocated(By.css('iframe#searchIframe')), 10000);
                    const searchIframe = await driver.findElement(By.css('iframe#searchIframe'));
                    await driver.switchTo().frame(searchIframe);
                    console.log('Switched back to searchIframe after error');
                } catch (frameError) {
                    console.error('Error switching back to searchIframe:', frameError);
                }
            }
        }

        // 결과 출력
        console.log('\n검색 결과:');
        results.forEach((place) => {
            console.log(`\n${place.id}. ${place.name} (${place.filter})`);
            console.log(`   주소: ${place.address}`);
            console.log(`   전화번호: ${place.tel || '없음'}`);
            console.log(`   예약가능: ${place.isBookable ? '예' : '아니오'}`);
            if (place.isBookable) {
                console.log(`   예약아이템: ${place.bookingItemsCount}개`);
            }
        });

        // JSON 파일로 저장
        const fs = require('fs');
        const path = require('path');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `search_results_${timestamp}.json`;
        const filepath = path.join(__dirname, '..', 'results', filename);

        // results 디렉토리가 없으면 생성
        const resultsDir = path.join(__dirname, '..', 'results');
        if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir, { recursive: true });
        }

        // JSON 파일로 저장
        fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
        console.log(`\n검색 결과가 ${filename} 파일로 저장되었습니다.`);

        // latest.json 파일 업데이트
        const latestPath = path.join(resultsDir, 'latest.json');
        fs.writeFileSync(latestPath, JSON.stringify({ filename, timestamp }, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await driver.quit();
    }
};

run(); 