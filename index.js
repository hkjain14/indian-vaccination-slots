const axios = require('axios');
const player = require('play-sound')(opts = {});

const retryTimeInSeconds = 30;
const validVaccines = ['COVISHIELD', 'COVAXIN', 'SPUTNIK V'];

async function getRequest(url) {
    const config = {
        headers: {
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36',
        },
    };
    try {
        const response = await axios.get(url, config);
        return response.data;
    } catch (e) {
        throw e;
    }
}

function generateCurrentDate() {
    const currentDateTime = new Date();
    const istDateTime = currentDateTime.toLocaleString('en-GB', {timeZone: 'Asia/Calcutta'})
    const splitDateTime = istDateTime.split('/');
    const date = splitDateTime[0];
    const month = splitDateTime[1];
    const year = splitDateTime[2].split(',')[0];
    return `${date}-${month}-${year}`;
}

function generateConfigs() {
    const myArgs = process.argv.slice(2);
    let pinCode, area, pinCodeArray;
    const firstArg = myArgs[0];
    pinCode = /^\d/.test(firstArg) ? firstArg : undefined;
    area = /^\d/.test(firstArg) ? undefined : firstArg;
    if (pinCode) {
        pinCodeArray = pinCode.split(',');
    }
    const age = myArgs[1] || 45;
    const vaccinePreference = myArgs[2];
    const ageToCheck = age >= 18 && age <= 44 ? 18 : 45;
    let upperCaseVaccinePreference = vaccinePreference && vaccinePreference.toUpperCase();
    if ((upperCaseVaccinePreference && !validVaccines.includes(upperCaseVaccinePreference)) || !upperCaseVaccinePreference) {
        upperCaseVaccinePreference = '';
    }
    const availableVaccines = ['', ...validVaccines];
    const matchVaccineArray = upperCaseVaccinePreference !== '' ? [vaccinePreference.toUpperCase()] : availableVaccines;
    return {ageToCheck, matchVaccineArray, area, pinCodeArray};
}

function generateDistrictWiseCentersUrl(districtId) {
    return `https://cdn-api.co-vin.in/api/v2/appointment/sessions/calendarByDistrict?district_id=${districtId}&date=${generateCurrentDate()}`;
}

async function generateCentersUrl(pinCodeArray, area) {
    let centersUrlArray = [];
    if (area) {
        const getStatesUrl = 'https://cdn-api.co-vin.in/api/v2/admin/location/states';
        const statesData = await getRequest(getStatesUrl);
        let areaArray = area.split('-');
        areaArray = areaArray.map((area) => {
            const result = area.replace(/([A-Z])/g, " $1");
            return result.charAt(0).toUpperCase() + result.slice(1);
        });
        const state = statesData.states.find((el) => areaArray[0] && areaArray[0].toLowerCase().includes(el.state_name.toLowerCase()));
        if (state) {
            const getDistrictsUrl = `https://cdn-api.co-vin.in/api/v2/admin/location/districts/${state.state_id}`;
            const districtsData = await getRequest(getDistrictsUrl);
            if (areaArray[1]) {
                const district = districtsData.districts.find((el) => areaArray[1] && areaArray[1].toLowerCase().includes(el.district_name.toLowerCase()));
                if (district) {
                    centersUrlArray.push(generateDistrictWiseCentersUrl(district.district_id));
                }
            } else {
                districtsData.districts.map((district) => {
                    centersUrlArray.push(generateDistrictWiseCentersUrl(district.district_id));
                });
            }
        }
    } else if (pinCodeArray) {
        pinCodeArray.map((pinCode) => {
            centersUrlArray.push(`https://cdn-api.co-vin.in/api/v2/appointment/sessions/calendarByPin?pincode=${pinCode}&date=${generateCurrentDate()}`);
        })
    }
    return centersUrlArray;
}

async function findVaccinationCenters(intervalId) {
    console.log('-----------');
    let numberOfOptionsFound = 0;
    const myArgs = process.argv.slice(2);
    const age = myArgs[1] || 45;
    if (age < 18 || age >= 130) {
        console.log('Invalid age entered. Please enter a valid age.');
        return true;
    }
    let isCenterFound = false;
    try {
        const {ageToCheck, matchVaccineArray, area, pinCodeArray} = generateConfigs();
        const centersUrlArray = await generateCentersUrl(pinCodeArray, area);
        if (centersUrlArray.length > 0) {
            await Promise.all(centersUrlArray.map(async (centersUrl) => {
                const {centers} = await getRequest(centersUrl);
                centers.map((center) => {
                    center.sessions.map((session) => {
                        if (session.min_age_limit === ageToCheck && session.available_capacity !== 0 && matchVaccineArray.includes(session.vaccine.toUpperCase())) {
                            numberOfOptionsFound++;
                            isCenterFound = true;
                            const vaccinationLogString = session.vaccine !== '' ? session.vaccine.toUpperCase() : 'Unknown';
                            const pincodeLogString =`(Pin : ${center.pincode}, District: ${center.district_name}) `;
                            const feeType = center.fee_type;
                            let cost;
                            if (feeType === 'Free') {
                                cost = feeType;
                            } else if (feeType === 'Paid') {
                                const vaccine = center.vaccine_fees && center.vaccine_fees.find((vacc) => vacc.vaccine === session.vaccine);
                                cost = vaccine ? `Rs. ${vaccine.fee}` : 'Paid';
                            }
                            const costString = `Cost = ${cost}`
                            console.log(`Dose1 : ${session.available_capacity_dose1} slots, Dose2 : ${session.available_capacity_dose2} slots available at ${center.name} ${pincodeLogString}on ${session.date} with vaccine : ${vaccinationLogString} ${costString}.`);
                        }
                    });
                });
            }));
        } else {
            console.log('Enter valid area. Tip: Enter district/state in SentenceCase like Delhi-SouthWestDelhi.');
            clearInterval(intervalId);
            return true;
        }
        if (!isCenterFound) {
            console.log('No available centers found in pincode/area for age specified for the next 7 days. Try choosing a nearby pincode/area.');
            console.log(`Retrying after ${retryTimeInSeconds} seconds`);
        } else {
            console.log('-----------');
            console.log(`A total of ${numberOfOptionsFound} options were found as per your preference.`);
            clearInterval(intervalId);
            player.play('./notification.mp3', function (err) {
                // if (err) throw err;
            });
        }
        return isCenterFound;
    } catch (e) {
        console.log(e.message);
        console.log('Unable to fetch data right now. Please try again later.');
        console.log(`Retrying after ${retryTimeInSeconds} seconds`);
        return false;
    }
}

async function run() {
    const isCenterFound = await findVaccinationCenters();
    if (!isCenterFound) {
        const intervalId = setInterval(async () => {
            await findVaccinationCenters(intervalId);
        }, retryTimeInSeconds * 1000);
    }
}

run();