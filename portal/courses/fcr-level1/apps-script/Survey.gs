/**
 * Course evaluation form for Foundations of Clinical Research · Level 1.
 *
 * Run setupSurvey() once from the editor, after setup(). It creates an anonymous, bilingual
 * Google Form in the "Neudata Certificates" folder. Its confirmation page shows
 * CONFIG.surveyCode, which participants enter on the certificate page. The same form is the
 * course evaluation in Session 8. Running it again keeps the existing form.
 */
function setupSurvey() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('SURVEY_ID')) {
    Logger.log('Survey already exists: %s', props.getProperty('SURVEY_URL'));
    return;
  }
  const form = FormApp.create('FCR Level 1 · Course evaluation');
  form.setDescription(
    'Foundations of Clinical Research · Level 1. About 3 minutes. Anonymous: we do not record your name or email.\n' +
    'Nền tảng Nghiên cứu Lâm sàng · Cấp độ 1. Khoảng 3 phút. Ẩn danh: chúng tôi không ghi lại tên hay email của bạn.')
    .setCollectEmail(false)
    .setRequireLogin(false)
    .setLimitOneResponsePerUser(false)
    .setShowLinkToRespondAgain(false)
    .setConfirmationMessage(
      'Thank you! Your survey completion code is ' + CONFIG.surveyCode + '. Enter it on the certificate page.\n' +
      'Cảm ơn bạn! Mã hoàn thành khảo sát của bạn là ' + CONFIG.surveyCode + '. Nhập mã này ở trang nhận chứng nhận.');

  form.addScaleItem().setTitle('Overall, how would you rate the course? / Nhìn chung, bạn đánh giá khóa học thế nào?')
    .setBounds(1, 5).setLabels('Poor / Kém', 'Excellent / Rất tốt').setRequired(true);
  form.addMultipleChoiceItem().setTitle('The pace was / Tốc độ của khóa học')
    .setChoiceValues(['Too slow / Quá chậm', 'About right / Vừa phải', 'Too fast / Quá nhanh']).setRequired(true);
  form.addScaleItem().setTitle('How confident are you now to write a research proposal? / Bây giờ bạn tự tin đến đâu khi viết một đề cương nghiên cứu?')
    .setBounds(1, 5).setLabels('Not at all / Hoàn toàn không', 'Very / Rất tự tin').setRequired(true);
  form.addScaleItem().setTitle('How confident are you now to write the Results section of a paper? / Bây giờ bạn tự tin đến đâu khi viết phần Kết quả của một bài báo?')
    .setBounds(1, 5).setLabels('Not at all / Hoàn toàn không', 'Very / Rất tự tin').setRequired(true);
  form.addCheckboxItem().setTitle('Which sessions were most useful? / Những buổi nào hữu ích nhất?')
    .setChoiceValues([
      'Session 1 · Ask / Buổi 1 · Đặt câu hỏi',
      'Session 2 · Find and read / Buổi 2 · Tìm và đọc y văn',
      'Session 3 · Design / Buổi 3 · Thiết kế',
      'Session 4 · Bias and effect / Buổi 4 · Sai lệch và đo lường tác động',
      'Session 5 · Data / Buổi 5 · Dữ liệu',
      'Session 6 · Analyse / Buổi 6 · Phân tích',
      'Session 7 · Protect and write / Buổi 7 · Bảo vệ người tham gia và viết bài',
      'Session 8 · Publish / Buổi 8 · Công bố']);
  form.addParagraphTextItem().setTitle('What should we improve? / Chúng tôi nên cải thiện điều gì?');
  form.addMultipleChoiceItem().setTitle('Would you recommend this course to a colleague? / Bạn có giới thiệu khóa học này cho đồng nghiệp không?')
    .setChoiceValues(['Yes / Có', 'Maybe / Có thể', 'No / Không']).setRequired(true);
  form.addMultipleChoiceItem().setTitle('Are you interested in Level 2 (statistical modelling in R)? / Bạn có quan tâm đến Cấp độ 2 (mô hình thống kê bằng R) không?')
    .setChoiceValues(['Yes / Có', 'Maybe / Có thể', 'No / Không']);
  form.addParagraphTextItem().setTitle('Any other comments (optional) / Ý kiến khác (không bắt buộc)');

  const root = DriveApp.getFolderById(props.getProperty('ROOT_ID'));
  DriveApp.getFileById(form.getId()).moveTo(root);
  props.setProperties({ SURVEY_ID: form.getId(), SURVEY_URL: form.getPublishedUrl() });
  Logger.log('Survey created. Share this link: %s', form.getPublishedUrl());
  Logger.log('Responses: %s', form.getEditUrl());
}

// The survey link for the certificate page: CONFIG.surveyUrl if set, else the form from setupSurvey().
function surveyUrl_() {
  return CONFIG.surveyUrl || PropertiesService.getScriptProperties().getProperty('SURVEY_URL') || '';
}
